import { Router } from "express";
import { getAdminUsers, updateUser, deleteUser, forceLogoutUser, getAdminUserById, updateUserProfile, approveUser } from "./Admin.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";

const adminOnly = (req: any, res: any, next: any) => {
  if (req.user?.role !== Role.ADMIN) {
    return next(new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Admin role required"));
  }
  next();
};

const router = Router();

// Apply auth and admin checks across all admin routes
router.use(authMiddleware as any, adminOnly as any);

router.get("/users", getAdminUsers as any);
router.get("/users/:id", getAdminUserById as any);
router.put("/users/:id/details", updateUser as any);
router.put("/users/:id/profile", updateUserProfile as any);
router.put("/users/:id/approve", approveUser as any);
router.delete("/users/:id/complete", deleteUser as any);
router.patch("/users/:id/force-logout", forceLogoutUser as any);

export default router;
