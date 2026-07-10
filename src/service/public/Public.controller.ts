import { Request, Response } from "express";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

/**
 * 1. Get Platform Stats (Public)
 * Endpoint: GET /api/v1/public/stats
 */
export const getPlatformStats = asyncHandler(async (req: Request, res: Response) => {
  // Aggregate stats from DB
  const ngoCount = await db.nGO.count();
  const campaignCount = await db.campaign.count();

  const donationSumResult = await db.donation.aggregate({
    where: { paymentStatus: "SUCCESS" },
    _sum: {
      amount: true,
    },
  });

  const uniqueDonorsResult = await db.donation.groupBy({
    by: ["userId"],
    where: { paymentStatus: "SUCCESS" },
  });

  const stats = {
    totalNgos: ngoCount,
    totalCampaigns: campaignCount,
    totalDonations: donationSumResult._sum.amount || 0,
    totalDonors: uniqueDonorsResult.length,
    currency: "INR",
  };

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Platform statistics retrieved successfully", stats));
});

/**
 * 2. Get Public Settings (Public)
 * Endpoint: GET /api/v1/public/settings
 */
export const getPublicSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = {
    siteName: "Care Ganga",
    supportEmail: process.env.BREVO_SENDER_EMAIL || "info.myogoku@gmail.com",
    contactPhone: "+91 9876543210",
    termsUrl: "https://careganga.org/terms",
    privacyUrl: "https://careganga.org/privacy",
    socialLinks: {
      facebook: "https://facebook.com/careganga",
      twitter: "https://twitter.com/careganga",
      instagram: "https://instagram.com/careganga",
    },
  };

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Public app settings fetched successfully", settings));
});

/**
 * 3. Get Public Notices (Announcements published by NGOs)
 * Endpoint: GET /api/v1/public/notices
 */
export const getPublicNotices = asyncHandler(async (req: Request, res: Response) => {
  const notices = await db.notice.findMany({
    where: {
      published: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    include: {
      ngo: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Public notices fetched successfully", notices));
});

/**
 * 4. Get My Notices (Notifications for logged-in user)
 * Endpoint: GET /api/v1/public/my-notices
 */
export const getMyNotices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(HTTP_STATUS.OK, "User notifications fetched successfully", notifications)
    );
});

/**
 * 5. Mark Notice/Notification as Read
 * Endpoint: PUT /api/v1/public/notices/:id/read
 */
export const markNoticeRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const notification = await db.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied to modify this notification");
  }

  const updatedNotification = await db.notification.update({
    where: { id },
    data: {
      read: true,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Notification marked as read successfully",
        updatedNotification
      )
    );
});

/**
 * 6. Get Unread Notice Count
 * Endpoint: GET /api/v1/public/unread-count
 */
export const getUnreadNoticeCount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
    }

    const count = await db.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return res
      .status(HTTP_STATUS.OK)
      .json(
        new ApiResponse(HTTP_STATUS.OK, "Unread notification count fetched successfully", { count })
      );
  }
);

/**
 * 7. Create Public Notice (Admin Only)
 * Endpoint: POST /api/v1/public/notices
 */
export const createPublicNotice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ngoId, title, content, priority = "NORMAL", published = true, expiresAt } = req.body;

  // 1. Verify NGO exists
  const ngo = await db.nGO.findUnique({
    where: { id: ngoId },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  // 2. Create the Notice
  const notice = await db.notice.create({
    data: {
      ngoId,
      title,
      content,
      priority,
      published,
      publishedAt: published ? new Date() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "Public notice created successfully", notice));
});
