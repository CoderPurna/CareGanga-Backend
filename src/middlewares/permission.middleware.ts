import { Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { ApiError } from "../utils/api-error.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { AuthenticatedRequest } from "./auth.middleware.js";
import { Role } from "../generated/prisma/index.js";

/**
 * Middleware to check if the authenticated user has a specific subadmin permission.
 * ADMIN users automatically bypass all permission checks.
 */
export const checkPermission = (requiredPermission: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      }

      // ADMIN bypasses all permission checks
      if (user.role === Role.ADMIN) {
        return next();
      }

      // For SUBADMIN, check the permission flag in the database
      const userPermissions: any = await db.permission.findUnique({
        where: { userId: user.id },
      });

      if (!userPermissions || !userPermissions[requiredPermission]) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Access denied: You do not have permission for the '${requiredPermission}' module`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
