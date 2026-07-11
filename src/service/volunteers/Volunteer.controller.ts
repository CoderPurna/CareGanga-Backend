import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { Role, VerificationStatus } from "../../generated/prisma/index.js";
import { sendVolunteerPendingEmail, sendVolunteerStatusEmail } from "../../utils/email.js";

/**
 * 1. Register Volunteer (Public - No Login Required)
 * Endpoint: POST /api/v1/volunteers/register
 */
export const registerVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    skills = [],
    availability,
    notes,
    profilePhoto,
    dob,
    bloodGroup,
    streetAddress,
    pinCode,
    city,
    state,
    aadhaarFront,
    aadhaarBack,
  } = req.body;

  // 1. Find or create user account for the volunteer
  let user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    const mockPassword = crypto.randomBytes(16).toString("hex");
    user = await db.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: mockPassword, // Required database field
        role: Role.SUBADMIN, // Default schema role is SUBADMIN, but has no privileges
        avatar: profilePhoto || null,
      },
    });
  } else {
    // Update phone/avatar if they were empty
    const updateData: any = {};
    if (!user.phone && phone) updateData.phone = phone;
    if (!user.avatar && profilePhoto) updateData.avatar = profilePhoto;
    if (Object.keys(updateData).length > 0) {
      user = await db.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  // 2. Prevent duplicate applications
  const existingApp = await db.volunteerApplication.findFirst({
    where: {
      userId: user.id,
    },
  });

  if (existingApp) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "A volunteer application from this email has already been submitted"
    );
  }

  // 3. Create the address record
  const address = await db.address.create({
    data: {
      line1: streetAddress,
      city,
      state,
      postalCode: pinCode,
      country: "India",
    },
  });

  // 4. Create the application
  const application = await db.volunteerApplication.create({
    data: {
      userId: user.id,
      skills,
      availability: availability || null,
      notes: notes || null,
      status: VerificationStatus.PENDING,
      profilePhoto: profilePhoto || null,
      dob: dob ? new Date(dob) : null,
      bloodGroup: bloodGroup || null,
      addressId: address.id,
      aadhaarFront: aadhaarFront || null,
      aadhaarBack: aadhaarBack || null,
    },
  });

  // 5. Send automated confirmation email in background
  sendVolunteerPendingEmail(email, name, "CareGanga NGO").catch((err) => {
    console.error("Failed to trigger volunteer confirmation email: ", err);
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(
      new ApiResponse(
        HTTP_STATUS.CREATED,
        "Volunteer application submitted successfully",
        application
      )
    );
});

/**
 * 2. List Volunteer Applications (Admin / Authorized Subadmin)
 * Endpoint: GET /api/v1/volunteers/admin/list
 */
export const listVolunteers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const page = parseInt(req.query.page as string) || 1;
  const skip = (page - 1) * limit;
  const status = req.query.status as VerificationStatus;

  const filter: any = {};
  if (status) {
    filter.status = status;
  }

  const total = await db.volunteerApplication.count({ where: filter });
  const applications = await db.volunteerApplication.findMany({
    where: filter,
    skip,
    take: limit,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      address: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Volunteer applications list fetched successfully", {
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
});

/**
 * 3. Get Volunteer Application Details (Admin / Authorized Subadmin)
 * Endpoint: GET /api/v1/volunteers/admin/:id
 */
export const getVolunteerDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;

    const application = await db.volunteerApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        address: true,
      },
    });

    if (!application) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Volunteer application not found");
    }

    return res
      .status(HTTP_STATUS.OK)
      .json(
        new ApiResponse(
          HTTP_STATUS.OK,
          "Volunteer application details fetched successfully",
          application
        )
      );
  }
);

/**
 * 4. Update Volunteer Application Status (Admin / Authorized Subadmin)
 * Endpoint: PATCH /api/v1/volunteers/admin/:id/status
 */
export const updateVolunteerStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const { status, notes } = req.body;

    const application = await db.volunteerApplication.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!application) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Volunteer application not found");
    }

    // Update status and joinedAt date if approved
    const updatedApp = await db.volunteerApplication.update({
      where: { id },
      data: {
        status: status as VerificationStatus,
        notes: notes || null,
        joinedAt: status === VerificationStatus.APPROVED ? new Date() : null,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        address: true,
      },
    });

    // Send status update notification email via Brevo
    if (updatedApp.user?.email) {
      sendVolunteerStatusEmail(
        updatedApp.user.email,
        updatedApp.user.name,
        "CareGanga NGO",
        status,
        notes
      ).catch((err) => {
        console.error("Failed to send status email notification: ", err);
      });
    }

    return res
      .status(HTTP_STATUS.OK)
      .json(
        new ApiResponse(
          HTTP_STATUS.OK,
          "Volunteer application status updated successfully",
          updatedApp
        )
      );
  }
);
