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
  const { name, email, phone, ngoId, skills = [], availability, notes } = req.body;

  // 1. Verify target NGO exists
  const ngo = await db.nGO.findUnique({
    where: { id: ngoId },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  // 2. Find or create user account for the volunteer
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
      },
    });
  }

  // 3. Prevent duplicate applications for the same NGO
  const existingApp = await db.volunteerApplication.findFirst({
    where: {
      userId: user.id,
      ngoId,
    },
  });

  if (existingApp) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "A volunteer application from this email has already been submitted for this NGO"
    );
  }

  // 4. Create the application
  const application = await db.volunteerApplication.create({
    data: {
      userId: user.id,
      ngoId,
      skills,
      availability: availability || null,
      notes: notes || null,
      status: VerificationStatus.PENDING,
    },
  });

  // 5. Send automated confirmation email in background
  sendVolunteerPendingEmail(email, name, ngo.name).catch((err) => {
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

  // NGO Boundary Check: If subadmin has an associated ngoId, restrict them to their NGO's applications
  const userNgoId = (req.user as any)?.ngoId;
  if (userNgoId) {
    filter.ngoId = userNgoId;
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
      ngo: {
        select: {
          name: true,
        },
      },
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
        ngo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!application) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Volunteer application not found");
    }

    // NGO Boundary Check
    const userNgoId = (req.user as any)?.ngoId;
    if (userNgoId && application.ngoId !== userNgoId) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied to view this volunteer application");
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
        ngo: true,
      },
    });

    if (!application) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Volunteer application not found");
    }

    // NGO Boundary Check
    const userNgoId = (req.user as any)?.ngoId;
    if (userNgoId && application.ngoId !== userNgoId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied to modify this volunteer application"
      );
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
        ngo: {
          select: {
            name: true,
          },
        },
      },
    });

    // Send status update notification email via Brevo
    if (updatedApp.user?.email) {
      sendVolunteerStatusEmail(
        updatedApp.user.email,
        updatedApp.user.name,
        updatedApp.ngo.name,
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
