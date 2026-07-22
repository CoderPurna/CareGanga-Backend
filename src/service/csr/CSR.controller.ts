import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { Role, UserStatus } from "../../generated/prisma/index.js";
import { sendCompanyPendingEmail, sendCompanyStatusEmail } from "../../utils/email.js";

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

/**
 * 5. Register Company (Public)
 * Endpoint: POST /api/v1/csr/register
 */
export const registerCompany = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    website,
    cinNumber,
    pocName,
    pocDesignation,
    email,
    phone,
    registeredAddress,
    areasOfInterest,
    partnershipTypes,
    projectedBudget,
    proposalSummary,
  } = req.body;

  // Check if User already exists with the official email address
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      "An account with this email address already exists"
    );
  }

  // Create User, Address, and Company in a single transaction
  const result = await db.$transaction(async (tx) => {
    const mockPassword = crypto.randomBytes(16).toString("hex");

    const user = await tx.user.create({
      data: {
        name: pocName,
        email,
        phone,
        password: mockPassword,
        role: Role.COMPANY,
        status: UserStatus.INACTIVE, // Pending verification
      },
    });

    const address = await tx.address.create({
      data: {
        line1: registeredAddress,
        city: "N/A",
        state: "N/A",
        country: "India",
        postalCode: "N/A",
      },
    });

    const company = await tx.company.create({
      data: {
        userId: user.id,
        addressId: address.id,
        name,
        website,
        email,
        phone,
        cinNumber: cinNumber || null,
        pocName,
        pocDesignation,
        areasOfInterest,
        partnershipTypes,
        projectedBudget: projectedBudget || null,
        proposalSummary,
        verified: false,
      },
    });

    return { user, address, company };
  });

  // Send confirmation email asynchronously (ignore errors to avoid blocking API response)
  sendCompanyPendingEmail(email, name, pocName).catch((err) => {
    console.error("Failed to send pending email: ", err);
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "Company registration request submitted successfully", result.company));
});

/**
 * 6. Get All Companies (Admin Only)
 * Endpoint: GET /api/v1/csr/admin/companies
 */
export const adminGetCompanies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const page = parseInt(req.query.page as string) || 1;
  const skip = (page - 1) * limit;
  const verified = req.query.verified === "true" ? true : req.query.verified === "false" ? false : undefined;

  const filter: any = {};
  if (verified !== undefined) {
    filter.verified = verified;
  }

  const total = await db.company.count({ where: filter });
  const companies = await db.company.findMany({
    where: filter,
    skip,
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          status: true,
          role: true,
        },
      },
      address: true,
    },
    orderBy: [
      { verified: "asc" }, // Unverified first
      { createdAt: "desc" },
    ],
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Companies list fetched successfully for admin", {
      companies,
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
 * 7. Approve Company Registration (Admin Only)
 * Endpoint: PATCH /api/v1/csr/admin/companies/:id/approve
 */
export const adminApproveCompany = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const company = await db.company.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Company profile not found");
  }

  if (company.verified) {
    return res
      .status(HTTP_STATUS.OK)
      .json(new ApiResponse(HTTP_STATUS.OK, "Company is already verified/approved", company));
  }

  const updated = await db.$transaction(async (tx) => {
    // 1. Set Company verified to true
    const updatedCompany = await tx.company.update({
      where: { id },
      data: { verified: true },
    });

    // 2. Set User status to ACTIVE
    await tx.user.update({
      where: { id: company.userId },
      data: { status: UserStatus.ACTIVE },
    });

    return updatedCompany;
  });

  // Send status update email (ignore errors to avoid blocking API response)
  if (company.email) {
    sendCompanyStatusEmail(company.email, company.name, company.pocName, "APPROVED").catch((err) => {
      console.error("Failed to send approval email: ", err);
    });
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Company registration approved successfully", updated));
});

/**
 * 8. Reject Company Registration (Admin Only)
 * Endpoint: PATCH /api/v1/csr/admin/companies/:id/reject
 */
export const adminRejectCompany = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { remarks } = req.body;

  const company = await db.company.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Company profile not found");
  }

  // Set User status to INACTIVE (rejecting approval)
  await db.user.update({
    where: { id: company.userId },
    data: { status: UserStatus.INACTIVE },
  });

  // Send status update email (ignore errors to avoid blocking API response)
  if (company.email) {
    sendCompanyStatusEmail(company.email, company.name, company.pocName, "REJECTED", remarks).catch((err) => {
      console.error("Failed to send rejection email: ", err);
    });
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Company registration rejected successfully", { remarks }));
});
