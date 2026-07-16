import { Router, Response, NextFunction } from "express";
import {
  registerVolunteer,
  listVolunteers,
  getVolunteerDetails,
  updateVolunteerStatus,
  deleteVolunteer,
  checkVolunteerStatus,
} from "./Volunteer.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { registerVolunteerSchema, updateVolunteerStatusSchema } from "./Volunteer.validation.js";

const router = Router();

// Middleware to restrict volunteer management to ADMINs or SUBADMINs with explicit "volunteers" access
const checkVolunteerAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user) {
    return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required"));
  }

  // Admin role has full access
  if (user.role === Role.ADMIN) {
    return next();
  }

  // Subadmin must have "volunteers" permission set to true
  if (user.role === Role.SUBADMIN) {
    const hasPermission = (user as any).permissions;
    if (hasPermission && hasPermission.volunteers) {
      return next();
    }
  }

  return next(
    new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: You do not have permission for the 'volunteers' module"
    )
  );
};

/**
 * ============================================================================
 * PUBLIC ENDPOINT (No login required)
 * ============================================================================
 */
router.post("/register", validate(registerVolunteerSchema), registerVolunteer as any);
router.get("/status", checkVolunteerStatus as any);

/**
 * ============================================================================
 * ADMIN & SUBADMIN PROTECTED ENDPOINTS
 * ============================================================================
 */
router.get(
  "/admin/list",
  authMiddleware as any,
  checkVolunteerAccess as any,
  listVolunteers as any
);
router.get(
  "/admin/:id",
  authMiddleware as any,
  checkVolunteerAccess as any,
  getVolunteerDetails as any
);
router.patch(
  "/admin/:id/status",
  authMiddleware as any,
  checkVolunteerAccess as any,
  validate(updateVolunteerStatusSchema),
  updateVolunteerStatus as any
);
router.delete(
  "/admin/:id",
  authMiddleware as any,
  checkVolunteerAccess as any,
  deleteVolunteer as any
);

export default router;
