import { Router, Response, NextFunction } from "express";
import {
  createOrder,
  verifyPayment,
  simulateSuccess,
  getReceiptPdf,
  getAllDonationsAdmin,
  getMyDonationsDonor,
  getDonationStatsAdmin,
  refundDonation,
} from "./Payment.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import {
  createOrderSchema,
  verifyPaymentSchema,
  simulateSuccessSchema,
  refundPaymentSchema,
} from "./Payment.validation.js";

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
 * DONOR / AUTHENTICATED ROUTES
 * ============================================================================
 */
router.post(
  "/create-order",
  authMiddleware as any,
  validate(createOrderSchema),
  createOrder as any
);
router.post(
  "/verify-payment",
  authMiddleware as any,
  validate(verifyPaymentSchema),
  verifyPayment as any
);
router.post(
  "/simulate-success",
  authMiddleware as any,
  validate(simulateSuccessSchema),
  simulateSuccess as any
);
router.get("/receipt/:id", authMiddleware as any, getReceiptPdf as any);
router.get("/my-donations", authMiddleware as any, getMyDonationsDonor as any);

/**
 * ============================================================================
 * ADMIN-ONLY ROUTES
 * ============================================================================
 */
router.get(
  "/admin/donations",
  authMiddleware as any,
  adminOnly as any,
  getAllDonationsAdmin as any
);
router.get("/admin/stats", authMiddleware as any, adminOnly as any, getDonationStatsAdmin as any);
router.post(
  "/admin/refund",
  authMiddleware as any,
  adminOnly as any,
  validate(refundPaymentSchema),
  refundDonation as any
);

export default router;
