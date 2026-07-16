import { Request, Response } from "express";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { Role, DonationStatus } from "../../generated/prisma/index.js";

/**
 * 1. Create Donation (Authenticated User)
 */
export const createDonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required to donate");
  }

  // 1. Verify user role: ADMIN can create, SUBADMIN needs donations permission
  if (userRole === Role.ADMIN) {
    // Authorized
  } else if (userRole === Role.SUBADMIN) {
    const hasPermission = await db.permission.findUnique({
      where: { userId },
    });
    if (!hasPermission || !hasPermission.donations) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied: You do not have permission to create donations"
      );
    }
  } else {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: Only Admins and authorized Subadmins can create donations"
    );
  }

  const {
    campaignId,
    amount,
    currency = "INR",
    paymentMethod,
    transactionId,
    anonymous = false,
    message,
  } = req.body;

  // 1. Verify if campaign exists (if campaignId is provided)
  if (campaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
    }
  }

  // 2. Prevent duplicate transaction checks
  const existingDonation = await db.donation.findUnique({
    where: { transactionId },
  });

  if (existingDonation) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "Donation with this transaction ID already registered"
    );
  }

  // 3. Resolve corporate company profile if user is corporate donor
  const companyProfile = await db.company.findUnique({
    where: { userId },
  });

  // 4. Create the donation record
  const donation = await db.donation.create({
    data: {
      campaignId: campaignId || null,
      userId,
      companyId: companyProfile ? companyProfile.id : null,
      amount,
      currency,
      paymentMethod,
      paymentStatus: DonationStatus.PENDING, // Default status
      transactionId,
      anonymous,
      message: message || null,
    },
    include: {
      campaign: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "Donation registered successfully", donation));
});

/**
 * 2. Get Donations List (Paginated & Role-based filtering)
 */
export const getDonationsList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const page = req.query.page ? Number(req.query.page) : 1;
  const campaignId = req.query.campaignId as string | undefined;
  const paymentStatus = req.query.paymentStatus as DonationStatus | undefined;

  const parsedLimit = limit;
  const parsedPage = page;
  const skip = (parsedPage - 1) * parsedLimit;

  // Build filters based on Role and query parameters
  const filter: any = {};
  if (campaignId) filter.campaignId = campaignId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  let ngoProfile = null;

  if (userRole === Role.ADMIN) {
    // Check if the user is an NGO creator/admin
    const adminNgo = await db.nGO.findUnique({
      where: { userId },
    });
    if (adminNgo) {
      ngoProfile = adminNgo;
      filter.campaign = { ngoId: adminNgo.id };
    }
    // If no adminNgo found, they are a platform super-admin; no NGO filter applied
  } else if (userRole === Role.SUBADMIN) {
    // Verify subadmin has the "donations" permission
    const hasPermission = await db.permission.findUnique({
      where: { userId },
    });
    if (!hasPermission || !hasPermission.donations) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied: You do not have permission for the 'donations' module"
      );
    }

    const userNgoId = (req.user as any)?.ngoId;
    if (userNgoId) {
      ngoProfile = { id: userNgoId };
      filter.campaign = { ngoId: userNgoId };
    } else {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied: Subadmin has no associated NGO profile"
      );
    }
  } else {
    // Regular donor/user: only see own donations
    filter.userId = userId;
  }

  // Query database
  const donations = await db.donation.findMany({
    where: filter,
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          slug: true,
          ngoId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      },
    },
    take: parsedLimit,
    skip: skip,
    orderBy: {
      donatedAt: "desc",
    },
  });

  const total = await db.donation.count({ where: filter });

  // Sanitize anonymous donations for non-owners/staff
  const sanitizedDonations = donations.map((donation) => {
    const isOwnerOrStaff = ngoProfile && donation.campaign && (donation as any).campaign.ngoId === ngoProfile.id;
    const isDonorSelf = donation.userId === userId;
    const isPlatformAdmin = userRole === Role.ADMIN && !ngoProfile;

    if (donation.anonymous && !isDonorSelf && !isOwnerOrStaff && !isPlatformAdmin) {
      return {
        ...donation,
        user: {
          id: (donation as any).user.id,
          name: "Anonymous Donor",
          avatar: null,
          email: undefined,
        },
      };
    }
    return donation;
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Donations list fetched successfully", {
      donations: sanitizedDonations,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    })
  );
});

/**
 * 3. Get Donation Details by ID
 */
export const getDonationDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const donationId = req.params.id as string;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const donation = await db.donation.findUnique({
    where: { id: donationId },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          ngoId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!donation) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Donation not found");
  }

  // Access Control: check if user is Platform Admin, NGO Owner (ADMIN), NGO Staff (SUBADMIN), or Donor
  let hasAccess = false;
  let isNGOStaff = false;

  if (userRole === Role.ADMIN) {
    const adminNgo = await db.nGO.findUnique({
      where: { userId },
    });
    // Platform admin (no associated NGO) or owner of the campaign's NGO
    if (!adminNgo || (donation.campaign && adminNgo.id === donation.campaign.ngoId)) {
      hasAccess = true;
      isNGOStaff = !!adminNgo;
    }
  } else if (userRole === Role.SUBADMIN) {
    // Verify subadmin has the "donations" permission
    const hasPermission = await db.permission.findUnique({
      where: { userId },
    });
    if (!hasPermission || !hasPermission.donations) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied: You do not have permission for the 'donations' module"
      );
    }

    const userNgoId = (req.user as any)?.ngoId;
    if (userNgoId && donation.campaign && userNgoId === donation.campaign.ngoId) {
      hasAccess = true;
      isNGOStaff = true;
    }
  } else if (donation.userId === userId) {
    hasAccess = true;
  }

  if (!hasAccess) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied to view this donation");
  }

  // Sanitize response if donor is anonymous and viewer is not owner/staff/platform-admin/donor
  if (
    donation.anonymous &&
    donation.userId !== userId &&
    !isNGOStaff &&
    (userRole !== Role.ADMIN || isNGOStaff)
  ) {
    (donation as any).user = {
      id: donation.userId,
      name: "Anonymous Donor",
      avatar: null,
      email: null as any,
      phone: null as any,
    } as any;
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Donation details fetched successfully", donation));
});

/**
 * 4. Update Donation Status (Admin/Staff only)
 */
export const updateDonationStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const donationId = req.params.id as string;
    const { paymentStatus } = req.body;

    if (!userId) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
    }

    const donation = await db.donation.findUnique({
      where: { id: donationId },
      include: {
        campaign: true,
      },
    });

    if (!donation) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Donation record not found");
    }

    // Verify the logged-in user is the owner/staff of the NGO that runs the campaign
    let isAuthorized = false;

    if (userRole === Role.ADMIN) {
      const adminNgo = await db.nGO.findUnique({
        where: { userId },
      });
      // Platform admin (no NGO) or the owner of the NGO running the campaign
      if (!adminNgo || adminNgo.id === (donation as any).campaign.ngoId) {
        isAuthorized = true;
      }
    } else if (userRole === Role.SUBADMIN) {
      // Verify subadmin has the "donations" permission
      const hasPermission = await db.permission.findUnique({
        where: { userId },
      });
      if (!hasPermission || !hasPermission.donations) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "Access denied: You do not have permission to manage donations"
        );
      }

      const userNgoId = (req.user as any)?.ngoId;
      if (userNgoId && userNgoId === (donation as any).campaign.ngoId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied: You cannot update donation status for this NGO"
      );
    }

    const updatedDonation = await db.donation.update({
      where: { id: donationId },
      data: { paymentStatus },
    });

    return res
      .status(HTTP_STATUS.OK)
      .json(
        new ApiResponse(HTTP_STATUS.OK, "Donation status updated successfully", updatedDonation)
      );
  }
);

/**
 * 5. Donation Analytics Summary (NGO / Personal / Global scopes)
 */
export const getDonationAnalytics = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
    }

    const filter: any = {
      paymentStatus: DonationStatus.SUCCESS,
    };

    let scope = "global";

    if (userRole === Role.ADMIN) {
      const adminNgo = await db.nGO.findUnique({
        where: { userId },
      });
      if (adminNgo) {
        scope = "ngo";
        filter.campaign = { ngoId: adminNgo.id };
      }
    } else if (userRole === Role.SUBADMIN) {
      // Verify subadmin has the "donations" permission
      const hasPermission = await db.permission.findUnique({
        where: { userId },
      });
      if (!hasPermission || !hasPermission.donations) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "Access denied: You do not have permission for the 'donations' module"
        );
      }

      const userNgoId = (req.user as any)?.ngoId;
      if (userNgoId) {
        scope = "ngo";
        filter.campaign = { ngoId: userNgoId };
      } else {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Subadmin has no associated NGO");
      }
    } else {
      scope = "personal";
      filter.userId = userId;
    }

    // 1. Total & Count
    const aggregateResult = await db.donation.aggregate({
      where: filter,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalDonated = aggregateResult._sum.amount || 0;
    const donationCount = aggregateResult._count.id || 0;
    const averageDonation = donationCount > 0 ? totalDonated / donationCount : 0;

    // 2. Group by Payment Method
    const paymentMethodGroups = await db.donation.groupBy({
      by: ["paymentMethod"],
      where: filter,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    const paymentMethods = paymentMethodGroups.map((g) => ({
      method: g.paymentMethod,
      total: g._sum.amount || 0,
      count: g._count.id,
    }));

    // 3. Recent Successful Donations (limit 5)
    const recentDonations = await db.donation.findMany({
      where: filter,
      include: {
        campaign: {
          select: {
            title: true,
          },
        },
        user: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
      take: 5,
      orderBy: {
        donatedAt: "desc",
      },
    });

    // Sanitize anonymous donors in recent donations if it's a personal scope request from someone else (shouldn't happen since personal filters by userId, but good safeguard)
    const sanitizedRecent = recentDonations.map((d) => {
      if (d.anonymous && scope !== "ngo" && scope !== "global" && d.userId !== userId) {
        return {
          ...d,
          user: {
            name: "Anonymous Donor",
            avatar: null,
          },
        };
      }
      return d;
    });

    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, "Donation analytics summary fetched successfully", {
        scope,
        summary: {
          totalDonated,
          donationCount,
          averageDonation,
        },
        paymentMethods,
        recentDonations: sanitizedRecent,
      })
    );
  }
);

/**
 * 6. Admin Get All Donors (Platform Admin Only)
 * Endpoint: GET /api/v1/donations/admin/donors
 */
export const adminGetDonors = asyncHandler(async (req: Request, res: Response) => {
  const donors = await db.user.findMany({
    where: {
      OR: [
        { role: Role.DONOR },
        { donations: { some: {} } },
      ],
    },
    include: {
      donations: {
        include: {
          campaign: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { donatedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Donors list retrieved successfully", donors));
});
