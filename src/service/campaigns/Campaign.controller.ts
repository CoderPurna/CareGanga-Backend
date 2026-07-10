import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { CampaignStatus } from "../../generated/prisma/index.js";

/**
 * 1. Create Campaign
 */
export const createCampaign = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  let ngoProfile;

  // Retrieve the NGO profile depending on the role
  if (userRole === "ADMIN") {
    ngoProfile = await db.nGO.findUnique({
      where: { userId },
    });
  } else if (userRole === "SUBADMIN") {
    const userNgoId = (req.user as any)?.ngoId;
    if (userNgoId) {
      ngoProfile = await db.nGO.findUnique({
        where: { id: userNgoId },
      });
    }
  }

  if (!ngoProfile) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  const { title, description, goalAmount, startDate, endDate, thumbnail, banner, status } =
    req.body;

  // Generate a unique slug for the campaign
  const randomSuffix = crypto.randomBytes(3).toString("hex");
  const slug = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")}-${randomSuffix}`;

  const campaign = await db.campaign.create({
    data: {
      ngoId: ngoProfile.id,
      title,
      slug,
      description,
      goalAmount,
      startDate,
      endDate,
      thumbnail: thumbnail || null,
      banner: banner || null,
      status: status || CampaignStatus.DRAFT,
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "Campaign created successfully", campaign));
});

/**
 * 2. Get All Campaigns (Public)
 */
export const getAllCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const { status, limit = 10, page = 1 } = req.query;

  const filter: any = {};
  if (status) {
    filter.status = status as any;
  }

  const parsedLimit = Number(limit) || 10;
  const parsedPage = Number(page) || 1;
  const skip = (parsedPage - 1) * parsedLimit;

  const campaigns = await db.campaign.findMany({
    where: filter,
    include: {
      ngo: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    take: parsedLimit,
    skip: skip,
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await db.campaign.count({ where: filter });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Campaigns retrieved successfully", {
      campaigns,
      pagination: {
        current: parsedPage,
        total: Math.ceil(total / parsedLimit),
        count: campaigns.length,
      },
    })
  );
});

/**
 * 3. Get Campaign By ID
 */
export const getCampaign = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      ngo: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Campaign retrieved successfully", campaign));
});

/**
 * 4. Update Campaign
 */
export const updateCampaign = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // Retrieve campaign and verify NGO ownership
  const campaign: any = await db.campaign.findUnique({
    where: { id },
    include: { ngo: true },
  });

  if (!campaign) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
  }

  // Verify ownership based on user role (Admin vs Subadmin)
  const isAuthorized =
    (userRole === "ADMIN" && campaign.ngo.userId === userId) ||
    (userRole === "SUBADMIN" && campaign.ngoId === (req.user as any)?.ngoId);

  if (!isAuthorized) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Not authorized to update this campaign");
  }

  const { title, description, goalAmount, startDate, endDate, thumbnail, banner, status } =
    req.body;

  // Re-generate slug if the title is changing
  let slug = undefined;
  if (title && title !== campaign.title) {
    const randomSuffix = crypto.randomBytes(3).toString("hex");
    slug = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")}-${randomSuffix}`;
  }

  const updatedCampaign = await db.campaign.update({
    where: { id },
    data: {
      title: title || undefined,
      slug: slug || undefined,
      description: description || undefined,
      goalAmount: goalAmount !== undefined ? goalAmount : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      thumbnail: thumbnail || undefined,
      banner: banner || undefined,
      status: status || undefined,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Campaign updated successfully", updatedCampaign));
});

/**
 * 5. Delete Campaign
 */
export const deleteCampaign = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // Retrieve campaign and verify NGO ownership
  const campaign: any = await db.campaign.findUnique({
    where: { id },
    include: { ngo: true },
  });

  if (!campaign) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
  }

  // Verify ownership based on user role (Admin vs Subadmin)
  const isAuthorized =
    (userRole === "ADMIN" && campaign.ngo.userId === userId) ||
    (userRole === "SUBADMIN" && campaign.ngoId === (req.user as any)?.ngoId);

  if (!isAuthorized) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Not authorized to delete this campaign");
  }

  await db.campaign.delete({
    where: { id },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Campaign deleted successfully", {}));
});
