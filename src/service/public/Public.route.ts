import { Router } from "express";
import {
  getPlatformStats,
  getPublicSettings,
  getPublicNotices,
  getMyNotices,
  markNoticeRead,
  getUnreadNoticeCount,
  createPublicNotice,
} from "./Public.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { noticeIdSchema, createNoticeSchema } from "./Public.validation.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";

const router = Router();

// Middleware to strictly enforce platform ADMIN-only access
const adminOnly = (req: AuthenticatedRequest, res: any, next: any) => {
  if (req.user?.role !== Role.ADMIN) {
    return next(new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Platform Admin role required"));
  }
  next();
};

// Public unauthenticated routes
router.get("/stats", getPlatformStats as any);
router.get("/settings", getPublicSettings as any);
router.get("/notices", getPublicNotices as any);

// Authenticated notification/notices routes (NGO Admins and Subadmins)
router.get("/my-notices", authMiddleware as any, getMyNotices as any);
router.put(
  "/notices/:id/read",
  authMiddleware as any,
  validate(noticeIdSchema),
  markNoticeRead as any
);
router.get("/unread-count", authMiddleware as any, getUnreadNoticeCount as any);

// Admin-only route to create public notice announcements
router.post(
  "/notices",
  authMiddleware as any,
  adminOnly as any,
  validate(createNoticeSchema),
  createPublicNotice as any
);

export default router;
