import { Request, Response } from "express";
import crypto from "crypto";
import { razorpay } from "../../utils/razorpay.js";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { Role, MembershipStatus } from "../../generated/prisma/index.js";
import { sendMembershipInvoice } from "../../utils/email.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";

/**
 * ============================================================================
 * PUBLIC & CLIENT OPERATIONS
 * ============================================================================
 */

/**
 * 1. Get Active Tiers (Public)
 * Endpoint: GET /api/v1/memberships/tiers
 */
export const getActiveTiers = asyncHandler(async (req: Request, res: Response) => {
  const tiers = await db.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Active membership tiers fetched successfully", tiers));
});

/**
 * 2. Create Razorpay Order & Apply (Public - No Login)
 * Endpoint: POST /api/v1/memberships/apply
 */
export const createOrderAndApply = asyncHandler(async (req: Request, res: Response) => {
  const {
    ngoId,
    tierId,
    remarks,
    fullName,
    dob,
    gender,
    mobile,
    email,
    permanentAddress,
    billingAddress,
    sameAsPermanent,
    profileImage,
    supportingDocument,
  } = req.body;

  // 1. Verify Tier exists and is active
  const tier = await db.membershipTier.findUnique({
    where: { id: tierId },
  });

  if (!tier) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership tier not found");
  }

  if (!tier.isActive) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "The selected membership tier is currently inactive"
    );
  }

  // 2. Find or create user account for the member (Assign role MEMBER)
  let user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    const mockPassword = crypto.randomBytes(16).toString("hex");
    user = await db.user.create({
      data: {
        name: fullName,
        email,
        phone: mobile,
        password: mockPassword,
        role: Role.MEMBER,
        avatar: profileImage,
      },
    });
  } else {
    const updateData: any = {};
    if (!user.phone && mobile) updateData.phone = mobile;
    if (!user.avatar && profileImage) updateData.avatar = profileImage;
    if (user.role !== Role.ADMIN && user.role !== Role.SUBADMIN) {
      updateData.role = Role.MEMBER;
    }
    if (Object.keys(updateData).length > 0) {
      user = await db.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  // 3. Prevent duplicate active subscriptions
  const existingApp = await db.membershipApplication.findFirst({
    where: {
      userId: user.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  if (existingApp) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "You already have an active membership application/subscription"
    );
  }

  const existingMembership = await db.membership.findFirst({
    where: {
      userId: user.id,
      status: MembershipStatus.ACTIVE,
      expiryDate: { gt: new Date() },
    },
  });

  if (existingMembership) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "You already have an active membership subscription"
    );
  }

  // 4. Create address records
  const permAddr = await db.address.create({
    data: {
      line1: permanentAddress.streetAddress,
      city: permanentAddress.city,
      state: permanentAddress.state,
      postalCode: permanentAddress.pinCode,
      country: "India",
    },
  });

  let billAddrId = permAddr.id;
  if (!sameAsPermanent && billingAddress) {
    const billAddr = await db.address.create({
      data: {
        line1: billingAddress.streetAddress,
        city: billingAddress.city,
        state: billingAddress.state,
        postalCode: billingAddress.pinCode,
        country: "India",
      },
    });
    billAddrId = billAddr.id;
  } else {
    // Create duplicate record for billing to allow independent edits later
    const billAddr = await db.address.create({
      data: {
        line1: permanentAddress.streetAddress,
        city: permanentAddress.city,
        state: permanentAddress.state,
        postalCode: permanentAddress.pinCode,
        country: "India",
      },
    });
    billAddrId = billAddr.id;
  }

  // 5. Create Razorpay Order
  let order = null;
  if (tier.price > 0) {
    const amountInPaise = Math.round(tier.price * 100);
    const sanitizedPrefix = email.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10);
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `mb_${sanitizedPrefix}_${Date.now()}`,
      notes: {
        ngoId: ngoId && ngoId !== "guest" ? ngoId : null,
        tierId,
        email: email,
        fullName: fullName,
      },
    };

    try {
      order = await razorpay.orders.create(options);
    } catch (error: any) {
      console.error("Razorpay order creation failed: ", error);
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error?.message || "Failed to initialize payment with Razorpay"
      );
    }
  }

  // 6. Create the MembershipApplication in database
  const application = await db.membershipApplication.create({
    data: {
      userId: user.id,
      ngoId: ngoId && ngoId !== "guest" ? ngoId : null,
      tierId,
      status: MembershipStatus.PENDING,
      remarks: remarks || null,
      fullName,
      dob: new Date(dob),
      gender,
      mobile,
      email,
      permanentAddressId: permAddr.id,
      billingAddressId: billAddrId,
      profileImage,
      supportingDocument,
    },
    include: {
      ngo: {
        select: {
          name: true,
          email: true,
        },
      },
      tier: {
        select: {
          name: true,
          price: true,
        },
      },
    },
  });

  return res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, "Membership application generated successfully", {
      application,
      order: order
        ? {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
          }
        : null,
    })
  );
});

/**
 * 3. Verify Payment & Activate Membership (Public - No Login)
 * Endpoint: POST /api/v1/memberships/verify
 */
export const verifyMembershipPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, applicationId } = req.body;

  // 1. Verify Razorpay cryptosignature
  const secret = process.env.RAZORPAY_KEY_SECRET || "rzp_test_placeholder_secret";
  const signString = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signString.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Payment verification failed: Invalid signature");
  }

  // 2. Fetch target application
  const application = await db.membershipApplication.findUnique({
    where: { id: applicationId },
    include: {
      ngo: true,
      tier: true,
    },
  });

  if (!application) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership application not found");
  }

  // 3. Avoid processing if already activated
  if (application.status === MembershipStatus.ACTIVE) {
    let membership = await db.membership.findFirst({
      where: { userId: application.userId, status: MembershipStatus.ACTIVE },
      include: { tier: true },
    });
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Membership payment already verified and subscription is active",
        {
          application,
          membership,
        }
      )
    );
  }

  const durationDays = application.tier.duration;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + durationDays);

  // 4. Update Application & Create/Upsert Membership inside database transaction
  const result = await db.$transaction(async (tx) => {
    // Update Application Status
    const updatedApp = await tx.membershipApplication.update({
      where: { id: applicationId },
      data: {
        status: MembershipStatus.ACTIVE,
        reviewedAt: new Date(),
        remarks: application.remarks
          ? `${application.remarks} | Payment Ref: ${razorpay_payment_id}`
          : `Payment Verified successfully. Payment Ref: ${razorpay_payment_id}`,
      },
    });

    const membership = await tx.membership.create({
      data: {
        ngoId: application.ngoId,
        userId: application.userId,
        tierId: application.tierId,
        startDate: new Date(),
        expiryDate: expiryDate,
        status: MembershipStatus.ACTIVE,
        paymentId: razorpay_payment_id,
        fullName: application.fullName,
        dob: application.dob,
        gender: application.gender,
        mobile: application.mobile,
        email: application.email,
        permanentAddressId: application.permanentAddressId,
        billingAddressId: application.billingAddressId,
        profileImage: application.profileImage,
        supportingDocument: application.supportingDocument,
      },
      include: {
        tier: true,
      },
    });

    return { application: updatedApp, membership };
  });

  // 5. Asynchronously email receipt invoice via Brevo API
  const emailTarget = application.ngo?.email || application.email;
  const nameTarget = application.ngo?.name || application.fullName || "Public Member";

  if (emailTarget) {
    sendMembershipInvoice(
      emailTarget,
      nameTarget,
      application.tier.name,
      application.tier.price,
      application.tier.duration,
      razorpay_payment_id
    ).catch((err) => {
      console.error("Failed to trigger background invoice email: ", err);
    });
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Payment verified and membership activated successfully",
        result
      )
    );
});

/**
 * 4. Upload Documents for Membership Application (Public)
 * Endpoint: POST /api/v1/memberships/upload-docs
 */
export const uploadDocuments = asyncHandler(async (req: any, res: Response) => {
  const { applicationId } = req.body;
  const file = req.file;

  if (!applicationId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Application ID is required");
  }

  if (!file) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "No file uploaded");
  }

  const application = await db.membershipApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership application not found");
  }

  // Upload to Cloudinary
  const uploadRes = await uploadOnCloudinary(file.path, "membership-documents");

  if (!uploadRes) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to upload document to Cloudinary"
    );
  }

  // Save the Cloudinary file URL inside application remarks
  const updatedApp = await db.membershipApplication.update({
    where: { id: applicationId },
    data: {
      remarks: application.remarks
        ? `${application.remarks} | Document: ${uploadRes.secure_url}`
        : `Document: ${uploadRes.secure_url}`,
    },
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Document uploaded and attached to application remarks", {
      application: updatedApp,
      documentUrl: uploadRes.secure_url,
    })
  );
});

/**
 * 5. Get Membership Receipt (Public)
 * Endpoint: GET /api/v1/memberships/receipt/:id
 */
export const getReceipt = asyncHandler(async (req: Request, res: Response) => {
  const applicationId = req.params.id as string;

  const application = await db.membershipApplication.findUnique({
    where: { id: applicationId },
    include: {
      ngo: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          registrationNumber: true,
        },
      },
      tier: {
        select: {
          name: true,
          price: true,
          duration: true,
        },
      },
    },
  });

  if (!application) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Application record not found");
  }

  let activeMembership = null;
  if (application.ngoId) {
    activeMembership = await db.membership.findUnique({
      where: { ngoId: application.ngoId },
    });
  } else {
    activeMembership = await db.membership.findFirst({
      where: { userId: application.userId, tierId: application.tierId },
      orderBy: { startDate: "desc" },
    });
  }

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Subscription receipt details retrieved", {
      invoiceNumber: `INV-${application.id.substring(0, 8).toUpperCase()}`,
      ngo: application.ngo,
      tier: application.tier,
      applicationStatus: application.status,
      paymentId: activeMembership ? activeMembership.paymentId : null,
      startDate: activeMembership ? activeMembership.startDate : null,
      expiryDate: activeMembership ? activeMembership.expiryDate : null,
      amountPaid: application.tier.price,
      currency: "INR",
      paymentStatus: application.status === MembershipStatus.ACTIVE ? "SUCCESS" : "PENDING",
    })
  );
});

/**
 * ============================================================================
 * ADMIN OPERATIONS (Requires Role.ADMIN check in middleware / routing)
 * ============================================================================
 */

/**
 * 6. Admin Get All Tiers (Including Inactive)
 * Endpoint: GET /api/v1/memberships/admin/tiers
 */
export const adminGetAllTiers = asyncHandler(async (req: Request, res: Response) => {
  const tiers = await db.membershipTier.findMany({
    orderBy: { createdAt: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "All membership tiers retrieved successfully", tiers));
});

/**
 * 7. Admin Create Membership Tier
 * Endpoint: POST /api/v1/memberships/admin/tiers
 */
export const adminCreateTier = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, price, duration, benefits = [] } = req.body;

  const existingTier = await db.membershipTier.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existingTier) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "A membership tier with this name already exists");
  }

  const tier = await db.membershipTier.create({
    data: {
      name,
      description,
      price,
      duration,
      benefits,
      isActive: true,
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "Membership tier created successfully", tier));
});

/**
 * 8. Admin Update Membership Tier
 * Endpoint: PUT /api/v1/memberships/admin/tiers/:id
 */
export const adminUpdateTier = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, description, price, duration, benefits } = req.body;

  const tier = await db.membershipTier.findUnique({
    where: { id },
  });

  if (!tier) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership tier not found");
  }

  if (name && name.toLowerCase() !== tier.name.toLowerCase()) {
    const duplicate = await db.membershipTier.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (duplicate) {
      throw new ApiError(HTTP_STATUS.CONFLICT, "A membership tier with this name already exists");
    }
  }

  const updatedTier = await db.membershipTier.update({
    where: { id },
    data: {
      name: name || undefined,
      description: description || undefined,
      price: price !== undefined ? price : undefined,
      duration: duration !== undefined ? duration : undefined,
      benefits: benefits !== undefined ? benefits : undefined,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Membership tier updated successfully", updatedTier));
});

/**
 * 9. Admin Delete Membership Tier
 * Endpoint: DELETE /api/v1/memberships/admin/tiers/:id
 */
export const adminDeleteTier = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const tier = await db.membershipTier.findUnique({
    where: { id },
  });

  if (!tier) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership tier not found");
  }

  // Prevent deletion if active memberships are using it
  const activeMemberships = await db.membership.findFirst({
    where: {
      tierId: id,
      status: MembershipStatus.ACTIVE,
    },
  });

  if (activeMemberships) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "Cannot delete tier: It has active membership subscriptions linked to it. Toggle it to inactive instead."
    );
  }

  await db.membershipTier.delete({
    where: { id },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Membership tier deleted successfully", {}));
});

/**
 * 10. Admin Toggle Tier Active State
 * Endpoint: PATCH /api/v1/memberships/admin/tiers/:id/toggle
 */
export const adminToggleTierActive = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const tier = await db.membershipTier.findUnique({
    where: { id },
  });

  if (!tier) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership tier not found");
  }

  const updatedTier = await db.membershipTier.update({
    where: { id },
    data: {
      isActive: !tier.isActive,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(
        HTTP_STATUS.OK,
        `Membership tier has been ${updatedTier.isActive ? "activated" : "deactivated"} successfully`,
        updatedTier
      )
    );
});

/**
 * 11. Admin Get All Applications
 * Endpoint: GET /api/v1/memberships/admin/applications
 */
export const adminGetApplications = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const filter: any = {};
  if (status) {
    filter.status = status as MembershipStatus;
  }

  const applications = await db.membershipApplication.findMany({
    where: filter,
    include: {
      ngo: {
        select: {
          name: true,
          email: true,
          registrationNumber: true,
        },
      },
      tier: {
        select: {
          name: true,
          price: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(HTTP_STATUS.OK, "Applications list retrieved successfully", applications)
    );
});

/**
 * 12. Admin Get Application by ID
 * Endpoint: GET /api/v1/memberships/admin/applications/:id
 */
export const adminGetApplicationById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const application = await db.membershipApplication.findUnique({
    where: { id },
    include: {
      ngo: true,
      tier: true,
    },
  });

  if (!application) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership application not found");
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(HTTP_STATUS.OK, "Application details retrieved successfully", application)
    );
});

/**
 * 13. Admin Update Application Status
 * Endpoint: PATCH /api/v1/memberships/admin/applications/:id/status
 */
export const adminUpdateApplicationStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status, remarks } = req.body;

  const application = await db.membershipApplication.findUnique({
    where: { id },
    include: { tier: true },
  });

  if (!application) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership application not found");
  }

  const result = await db.$transaction(async (tx) => {
    const updatedApp = await tx.membershipApplication.update({
      where: { id },
      data: {
        status: status as MembershipStatus,
        remarks: remarks || null,
        reviewedAt: new Date(),
      },
    });

    let membership = null;

    if (status === MembershipStatus.ACTIVE) {
      const durationDays = application.tier.duration;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);

      const existingMembership = await tx.membership.findFirst({
        where: {
          userId: application.userId,
          status: MembershipStatus.ACTIVE,
        },
      });

      if (existingMembership) {
        membership = await tx.membership.update({
          where: { id: existingMembership.id },
          data: {
            startDate: new Date(),
            expiryDate,
            status: MembershipStatus.ACTIVE,
            paymentId: "MANUAL_ADMIN_UPGRADE",
            fullName: application.fullName,
            dob: application.dob,
            gender: application.gender,
            mobile: application.mobile,
            permanentAddressId: application.permanentAddressId,
            billingAddressId: application.billingAddressId,
            profileImage: application.profileImage,
            supportingDocument: application.supportingDocument,
          },
        });
      } else {
        membership = await tx.membership.create({
          data: {
            ngoId: application.ngoId,
            userId: application.userId,
            tierId: application.tierId,
            startDate: new Date(),
            expiryDate,
            status: MembershipStatus.ACTIVE,
            paymentId: "MANUAL_ADMIN_UPGRADE",
            fullName: application.fullName,
            dob: application.dob,
            gender: application.gender,
            mobile: application.mobile,
            email: application.email,
            permanentAddressId: application.permanentAddressId,
            billingAddressId: application.billingAddressId,
            profileImage: application.profileImage,
            supportingDocument: application.supportingDocument,
          },
        });
      }
    } else if (status === MembershipStatus.CANCELLED || status === MembershipStatus.EXPIRED) {
      membership = await tx.membership.updateMany({
        where: {
          userId: application.userId,
        },
        data: {
          status: status as MembershipStatus,
        },
      });
    }

    return { application: updatedApp, membership };
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Application status updated successfully", result));
});

/**
 * 14. Admin Delete Application
 * Endpoint: DELETE /api/v1/memberships/admin/applications/:id
 */
export const adminDeleteApplication = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const application = await db.membershipApplication.findUnique({
    where: { id },
  });

  if (!application) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Membership application not found");
  }

  await db.membershipApplication.delete({
    where: { id },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Membership application deleted successfully", {}));
});

/**
 * 15. Admin Get All Memberships (Active Members)
 * Endpoint: GET /api/v1/memberships/admin/members
 */
export const adminGetMemberships = asyncHandler(async (req: Request, res: Response) => {
  const { status, tierId } = req.query;

  const filter: any = {};
  if (status) {
    filter.status = status as MembershipStatus;
  }
  if (tierId) {
    filter.tierId = tierId as string;
  }

  const memberships = await db.membership.findMany({
    where: filter,
    include: {
      tier: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
      ngo: {
        select: {
          name: true,
          email: true,
        },
      },
      permanentAddress: true,
      billingAddress: true,
    },
    orderBy: { startDate: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(HTTP_STATUS.OK, "Active memberships list retrieved successfully", memberships)
    );
});
