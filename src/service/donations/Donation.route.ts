import { Router, Response, NextFunction } from "express";
import {
  createDonation,
  getDonationsList,
  getDonationDetails,
  updateDonationStatus,
  getDonationAnalytics,
  adminGetDonors,
} from "./Donation.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { createDonationSchema, updateDonationStatusSchema } from "./Donation.validation.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";

const router = Router();

// Middleware to restrict routes to platform ADMINs only
const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== Role.ADMIN) {
    return next(new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Platform Admin role required"));
  }
  next();
};

/**
 * ============================================================================
 * ADMIN-ONLY ENDPOINTS
 * ============================================================================
 */
router.get("/admin/donors", authMiddleware as any, adminOnly as any, adminGetDonors as any);

/**
 * ============================================================================
 * DONOR / AUTHENTICATED ROUTES
 * ============================================================================
 */
router.post("/", authMiddleware as any, validate(createDonationSchema), createDonation as any);
router.get("/", authMiddleware as any, getDonationsList as any);
router.get("/analytics/summary", authMiddleware as any, getDonationAnalytics as any);
router.get("/:id", authMiddleware as any, getDonationDetails as any);
router.put(
  "/:id/status",
  authMiddleware as any,
  validate(updateDonationStatusSchema),
  updateDonationStatus as any
);

export default router;
