import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { User, Permission } from "../generated/prisma/index.js";
import { Request } from "express";
import { HTTP_STATUS } from "../utils/constants.js";

export interface AuthenticatedRequest extends Request {
  user?: Omit<User, "password"> & { permissions?: Permission | null };
}

export const authMiddleware = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        throw new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          "Unauthorized request: Access token not found"
        );
      }

      const secret = process.env.ACCESS_TOKEN_SECRET;
      if (!secret) {
        throw new ApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "Server configuration error: Access token secret is missing"
        );
      }

      const decoded = jwt.verify(token, secret) as { id: string };

      const user = await db.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          emailVerified: true,
          ngoId: true,
          createdAt: true,
          updatedAt: true,
          permissions: true,
        },
      });

      if (!user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Invalid access token: User not found");
      }

      req.user = user;
      next();
    } catch (error: any) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, error?.message || "Invalid access token");
    }
  }
);

export const optionalAuthMiddleware = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        return next();
      }

      const secret = process.env.ACCESS_TOKEN_SECRET;
      if (!secret) {
        return next();
      }

      const decoded = jwt.verify(token, secret) as { id: string };

      const user = await db.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          emailVerified: true,
          ngoId: true,
          createdAt: true,
          updatedAt: true,
          permissions: true,
        },
      });

      if (user) {
        req.user = user;
      }
      next();
    } catch {
      // Ignore token validation errors for optional authentication
      next();
    }
  }
);
