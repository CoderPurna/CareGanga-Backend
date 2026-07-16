import { Router, Response, NextFunction } from "express";
import {
  getActiveTiers,
  createOrderAndApply,
  verifyMembershipPayment,
  uploadDocuments,
  getReceipt,
  adminGetAllTiers,
  adminCreateTier,
  adminUpdateTier,
  adminDeleteTier,
  adminToggleTierActive,
  adminGetApplications,
  adminGetApplicationById,
  adminUpdateApplicationStatus,
  adminDeleteApplication,
  adminGetMemberships,
} from "./Membership.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { upload } from "../../middlewares/multer.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import {
  createTierSchema,
  updateTierSchema,
  applyMembershipSchema,
  verifyMembershipPaymentSchema,
  updateApplicationStatusSchema,
} from "./Membership.validation.js";

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
 * CLIENT & PUBLIC ENDPOINTS (No User Login required for apply/verify)
 * ============================================================================
 */
router.get("/tiers", getActiveTiers as any);
router.post("/apply", validate(applyMembershipSchema), createOrderAndApply as any);
router.post("/verify", validate(verifyMembershipPaymentSchema), verifyMembershipPayment as any);
router.post("/upload-docs", upload.single("file"), uploadDocuments as any);
router.get("/receipt/:id", getReceipt as any);

/**
 * ============================================================================
 * PLATFORM ADMIN-ONLY ENDPOINTS (Requires Auth & Admin role)
 * ============================================================================
 */
router.use("/admin", authMiddleware as any, adminOnly as any);

// Tier Management
router.get("/admin/tiers", adminGetAllTiers as any);
router.post("/admin/tiers", validate(createTierSchema), adminCreateTier as any);
router.put("/admin/tiers/:id", validate(updateTierSchema), adminUpdateTier as any);
router.delete("/admin/tiers/:id", adminDeleteTier as any);
router.patch("/admin/tiers/:id/toggle", adminToggleTierActive as any);

// Application Management
router.get("/admin/applications", adminGetApplications as any);
router.get("/admin/applications/:id", adminGetApplicationById as any);
router.patch(
  "/admin/applications/:id/status",
  validate(updateApplicationStatusSchema),
  adminUpdateApplicationStatus as any
);
router.delete("/admin/applications/:id", adminDeleteApplication as any);

// Member Management
router.get("/admin/members", adminGetMemberships as any);

export default router;
