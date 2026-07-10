import { Request, Response } from "express";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

/**
 * 1. Submit CSR Request (Public)
 * Endpoint: POST /api/v1/csr/submit
 */
export const submitCsrRequest = asyncHandler(async (req: Request, res: Response) => {
  const { companyId, ngoId, subject, description } = req.body;

  // 1. Verify target NGO exists
  const ngo = await db.nGO.findUnique({
    where: { id: ngoId },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  // 2. Verify requesting Company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Company profile not found");
  }

  // 3. Create CSR Request (CSREnquiry)
  const csrRequest = await db.cSREnquiry.create({
    data: {
      companyId,
      ngoId,
      subject,
      description,
      status: "PENDING",
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "CSR request submitted successfully", csrRequest));
});

/**
 * 2. List CSR Requests (Admin Only)
 * Endpoint: GET /api/v1/csr/admin/list
 */
export const listCsrRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const page = parseInt(req.query.page as string) || 1;
  const skip = (page - 1) * limit;

  const total = await db.cSREnquiry.count();
  const requests = await db.cSREnquiry.findMany({
    skip,
    take: limit,
    include: {
      company: {
        select: {
          name: true,
          logo: true,
          website: true,
          email: true,
        },
      },
      ngo: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "CSR requests list fetched successfully", {
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
});

/**
 * 3. Get CSR Request Details (Admin Only)
 * Endpoint: GET /api/v1/csr/admin/:id
 */
export const getCsrDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const request = await db.cSREnquiry.findUnique({
    where: { id },
    include: {
      company: true,
      ngo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!request) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "CSR request not found");
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "CSR request details fetched successfully", request));
});

/**
 * 4. Update CSR Request Status (Admin Only)
 * Endpoint: PATCH /api/v1/csr/admin/:id/status
 */
export const updateCsrStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const request = await db.cSREnquiry.findUnique({
    where: { id },
  });

  if (!request) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "CSR request not found");
  }

  const updatedRequest = await db.cSREnquiry.update({
    where: { id },
    data: {
      status,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(HTTP_STATUS.OK, "CSR request status updated successfully", updatedRequest)
    );
});
