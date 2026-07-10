import { Router, Response, NextFunction } from "express";
import {
  submitCsrRequest,
  listCsrRequests,
  getCsrDetails,
  updateCsrStatus,
} from "./CSR.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { submitCsrRequestSchema, updateCsrStatusSchema } from "./CSR.validation.js";

const router = Router();

// Middleware to strictly enforce that the user is a platform ADMIN (No Subadmin access)
const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== Role.ADMIN) {
    return next(new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Platform Admin role required"));
  }
  next();
};

/**
 * ============================================================================
 * PUBLIC ROUTE (No Login Required)
 * ============================================================================
 */
router.post("/submit", validate(submitCsrRequestSchema), submitCsrRequest as any);

/**
 * ============================================================================
 * ADMIN-ONLY ROUTES (Requires Auth and strict ADMIN role)
 * ============================================================================
 */
router.get("/admin/list", authMiddleware as any, adminOnly as any, listCsrRequests as any);
router.get("/admin/:id", authMiddleware as any, adminOnly as any, getCsrDetails as any);
router.patch(
  "/admin/:id/status",
  authMiddleware as any,
  adminOnly as any,
  validate(updateCsrStatusSchema),
  updateCsrStatus as any
);

export default router;
