import { Request, Response } from "express";
import { db } from "../../db/db.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiResponse } from "../../utils/api-response.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { Role, UserStatus } from "../../generated/prisma/index.js";

// 1. Get all users
export const getAdminUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await db.user.findMany({
    include: {
      permissions: true,
      ngo: true,
      company: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Users retrieved successfully", users));
});

// 2. Update user details & permissions
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { fullName, name, email, phone, phoneNumber, isActive, permissions, avatar } = req.body;

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  const nameVal = (name || fullName || user.name) as string;
  const emailVal = (email || user.email) as string;
  const phoneVal = (phone || phoneNumber || user.phone || null) as string | null;

  // Update User fields
  await db.user.update({
    where: { id },
    data: {
      name: nameVal,
      email: emailVal,
      phone: phoneVal,
      avatar: avatar || user.avatar,
      status: isActive === false ? UserStatus.INACTIVE : UserStatus.ACTIVE,
    },
    include: {
      permissions: true,
    },
  });

  // Update permissions if provided
  if (permissions) {
    await db.permission.upsert({
      where: { userId: id },
      update: {
        dashboard: !!permissions.dashboard,
        donations: !!permissions.donations,
        volunteers: !!permissions.volunteers,
        campaigns: !!permissions.campaigns,
        deleteCampaigns: !!(permissions.deleteCampaigns || permissions["campaigns-delete"]),
        payments: !!permissions.payments,
        receipts: !!permissions.receipts,
        reports: !!permissions.reports,
      },
      create: {
        userId: id,
        dashboard: !!permissions.dashboard,
        donations: !!permissions.donations,
        volunteers: !!permissions.volunteers,
        campaigns: !!permissions.campaigns,
        deleteCampaigns: !!(permissions.deleteCampaigns || permissions["campaigns-delete"]),
        payments: !!permissions.payments,
        receipts: !!permissions.receipts,
        reports: !!permissions.reports,
      },
    });
  }

  const finalUser = await db.user.findUnique({
    where: { id },
    include: { permissions: true },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User updated successfully", finalUser));
});

// 3. Delete User
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  await db.user.delete({ where: { id } });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User deleted successfully", null));
});

// 4. Force Logout User
export const forceLogoutUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  await db.session.deleteMany({ where: { userId: id } });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User logged out from all sessions successfully", null));
});

// 5. Get User by ID
export const getAdminUserById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      permissions: true,
      ngo: true,
      company: true,
      donations: true,
      volunteerApplications: true,
      assignedTasks: true,
    },
  });

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  const campaigns = await db.campaign.findMany({
    where: {
      ngoId: user.ngo?.id || user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const stats = {
    totalDonations: user.donations.length,
    totalDonated: user.donations.reduce((sum, d) => sum + (d.amount || 0), 0),
    totalCampaigns: campaigns.length,
    totalVolunteered: user.volunteerApplications.length,
  };

  const activities = await db.activity.findMany({
    where: {
      userId: id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "User profile retrieved successfully", {
      userProfile: {
        user,
        profile: user.ngo || user.company || null,
        stats,
        activities,
        campaigns,
      },
    })
  );
});

// 6. Update User Profile (NGO or Company details)
export const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profile } = req.body;

  const user = await db.user.findUnique({
    where: { id },
    include: { ngo: true, company: true },
  });

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  if (user.ngo) {
    await db.nGO.update({
      where: { id: user.ngo.id },
      data: {
        name: profile?.ngoName || profile?.name || undefined,
        registrationNumber: profile?.registrationNumber || undefined,
        establishmentYear: profile?.establishmentYear || profile?.registeredYear?.toString() || undefined,
        website: profile?.website || undefined,
        ngoType: profile?.ngoType || undefined,
      },
    });
  } else if (user.company) {
    await db.company.update({
      where: { id: user.company.id },
      data: {
        name: profile?.companyName || profile?.name || undefined,
        industry: profile?.industry || undefined,
        website: profile?.website || undefined,
      },
    });
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User profile updated successfully", null));
});

// 7. Approve User
export const approveUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const user = await db.user.findUnique({
    where: { id },
    include: { ngo: true, company: true },
  });

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  if (user.ngo) {
    await db.nGO.update({
      where: { id: user.ngo.id },
      data: { verificationStatus: "APPROVED" },
    });
  } else if (user.company) {
    await db.company.update({
      where: { id: user.company.id },
      data: { verified: true },
    });
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User approved successfully", null));
});
