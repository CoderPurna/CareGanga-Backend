import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/token.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { Role } from "../../generated/prisma/index.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
};

// HELPER: Generate Access/Refresh tokens & create Database Session
const generateAccessAndRefreshTokens = async (user: any, req: Request) => {
  try {
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Hash refresh token for DB Session storage
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Session Expiry (7 days matching REFRESH_TOKEN_EXPIRY)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create session in the database
    await db.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        device: req.headers["user-agent"] || "Unknown",
        ip: req.ip || "Unknown",
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error generating authentication tokens");
  }
};

// 1. Signup Controller
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Name, email, and password are required fields");
  }

  // Check if user already exists
  const existingUser = await db.user.findFirst({
    where: {
      OR: [{ email }, phone ? { phone } : {}],
    },
  });

  if (existingUser) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "User with this email or phone number already exists");
  }

  // Hash Password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Validate and assign Role (Default is SUBADMIN)
  let userRole: Role = Role.SUBADMIN;
  if (role && (role === Role.ADMIN || role === Role.SUBADMIN)) {
    userRole = role as Role;
  }

  // Create User
  const user = await db.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      password: hashedPassword,
      role: userRole,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "User registered successfully", user));
});

// 2. Login Controller
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Email and password are required");
  }

  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User does not exist");
  }

  // Restrict login to ADMIN and SUBADMIN
  if (user.role !== Role.ADMIN && user.role !== Role.SUBADMIN) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: Only admins and subadmins can log in"
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Invalid credentials");
  }

  // Generate tokens & Save session
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user, req);

  const loggedInUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      permissions: true,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(HTTP_STATUS.OK, "User logged in successfully", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

// 3. Logout Controller
export const logoutUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Refresh token is required to logout");
  }

  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  // Remove the session from DB
  await db.session.deleteMany({
    where: {
      userId: req.user?.id,
      refreshTokenHash,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(HTTP_STATUS.OK, "User logged out successfully", {}));
});

// 4. Refresh Access Token Controller
export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(
      HTTP_STATUS.UNAUTHORIZED,
      "Unauthorized request: Refresh token not provided"
    );
  }

  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
  if (!refreshSecret) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Server configuration error: Refresh secret is missing"
    );
  }

  try {
    const decoded = jwt.verify(incomingRefreshToken, refreshSecret) as {
      id: string;
    };

    const refreshTokenHash = crypto.createHash("sha256").update(incomingRefreshToken).digest("hex");

    // Verify active session in DB
    const activeSession = await db.session.findFirst({
      where: {
        userId: decoded.id,
        refreshTokenHash,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });

    if (!activeSession) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Refresh token is expired, invalid, or revoked");
    }

    const user = await db.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Invalid refresh token: User not found");
    }

    // Generate new tokens
    const accessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Rotate session: Update existing session with new refresh token hash
    await db.session.update({
      where: { id: activeSession.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    return res
      .status(HTTP_STATUS.OK)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(HTTP_STATUS.OK, "Access token refreshed successfully", {
          accessToken,
          refreshToken: newRefreshToken,
        })
      );
  } catch (error: any) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, error?.message || "Invalid refresh token");
  }
});

// 5. Get User Controller (Profile)
export const getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User profile fetched successfully", req.user));
});

// 6. Update User Controller
export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, avatar } = req.body;

  if (!name && !phone && !avatar) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "At least one field (name, phone, avatar) is required to update"
    );
  }

  const userId = req.user?.id;

  if (phone) {
    // Ensure phone number isn't taken by another user
    const existingPhoneUser = await db.user.findFirst({
      where: {
        phone,
        id: { not: userId },
      },
    });

    if (existingPhoneUser) {
      throw new ApiError(HTTP_STATUS.CONFLICT, "Phone number is already in use by another account");
    }
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      name: name || undefined,
      phone: phone || undefined,
      avatar: avatar || undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User profile updated successfully", updatedUser));
});

// 7. Create Subadmin Controller (Exclusively by ADMIN)
export const createSubadmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // 1. Verify that the logged-in user is an ADMIN
  if (req.user?.role !== Role.ADMIN) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Only Admin can create subadmins");
  }

  const { name, email, phone, password, permissions } = req.body;

  // Check if user already exists
  const existingUser = await db.user.findFirst({
    where: {
      OR: [{ email }, phone ? { phone } : {}],
    },
  });

  if (existingUser) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "User with this email or phone number already exists");
  }

  // Hash Password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create Subadmin and set their permissions inside a database transaction
  const result = await db.$transaction(async (tx) => {
    // Fetch ADMIN's NGO profile
    const adminNgo = await tx.nGO.findUnique({
      where: { userId: req.user?.id },
    });

    if (!adminNgo) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        "Admin does not have a registered NGO profile. Subadmin cannot be created."
      );
    }

    // Create User with Role SUBADMIN associated with the NGO
    const user = await tx.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: Role.SUBADMIN,
        ngoId: adminNgo.id, // Linked!
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Insert fine-grained permissions
    const userPermissions = await tx.permission.create({
      data: {
        userId: user.id,
        dashboard: permissions?.dashboard ?? false,
        donations: permissions?.donations ?? false,
        volunteers: permissions?.volunteers ?? false,
        campaigns: permissions?.campaigns ?? false,
        deleteCampaigns: permissions?.deleteCampaigns ?? false,
        payments: permissions?.payments ?? false,
        receipts: permissions?.receipts ?? false,
        reports: permissions?.reports ?? false,
      },
    });

    return { user, permissions: userPermissions };
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(
      new ApiResponse(HTTP_STATUS.CREATED, "Subadmin created successfully with permissions", result)
    );
});
