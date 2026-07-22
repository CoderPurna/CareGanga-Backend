import { Router, Response, NextFunction } from "express";
import {
  submitCsrRequest,
  listCsrRequests,
  getCsrDetails,
  updateCsrStatus,
  registerCompany,
  adminGetCompanies,
  adminApproveCompany,
  adminRejectCompany,
} from "./CSR.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import {
  submitCsrRequestSchema,
  updateCsrStatusSchema,
  registerCompanySchema,
} from "./CSR.validation.js";

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
 * PUBLIC ROUTES (No Login Required)
 * ============================================================================
 */
router.post("/register", validate(registerCompanySchema), registerCompany as any);
router.post("/submit", validate(submitCsrRequestSchema), submitCsrRequest as any);

/**
 * ============================================================================
 * ADMIN-ONLY ROUTES (Requires Auth and strict ADMIN role)
 * ============================================================================
 */
router.use("/admin", authMiddleware as any, adminOnly as any);

router.get("/admin/list", listCsrRequests as any);
router.get("/admin/companies", adminGetCompanies as any);
router.patch("/admin/companies/:id/approve", adminApproveCompany as any);
router.patch("/admin/companies/:id/reject", adminRejectCompany as any);
router.get("/admin/:id", getCsrDetails as any);
router.patch("/admin/:id/status", validate(updateCsrStatusSchema), updateCsrStatus as any);

export default router;
