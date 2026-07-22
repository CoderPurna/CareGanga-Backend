import { Request, Response } from "express";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { Role } from "../../generated/prisma/index.js";
import { string } from "zod";

/**
 * 1. Create NGO Profile (ADMIN only, max 1 NGO per Admin)
 */
export const createNgoProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "User is not authenticated");
  }

  // 1. Verify user role
  if (userRole !== Role.ADMIN) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: Only Admin can create an NGO profile"
    );
  }

  // 2. Check if Admin already has an NGO profile
  const existingNgo = await db.nGO.findUnique({
    where: { userId },
  });

  if (existingNgo) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "NGO profile already exists for this admin");
  }

  const {
    // Basic Info
    name,
    shortName,
    logo,
    coverImage,
    description,
    establishmentYear,
    registrationNumber,
    registrationDate,
    ngoType,

    // Contact Info
    email,
    phone,
    whatsappNumber,
    website,
    googleMapUrl,
    address,

    // Legal
    registrationCertificate,
    panCard,
    certificate12A,
    certificate80G,
    csr1Certificate,
    fcraNumber,
    fcraCertificate,

    // Social Media
    facebookUrl,
    instagramUrl,
    linkedInUrl,
    youtubeUrl,
    twitterUrl,

    // Team Information
    founderName,
    presidentName,
    secretaryName,
    treasurerName,
    teamMembers,

    // Work Information
    mission,
    vision,
    focusAreas,
    operationalAreas,
    beneficiariesServed,
    volunteersCount,
  } = req.body;

  // 3. Check if registration number is already taken
  const duplicateReg = await db.nGO.findUnique({
    where: { registrationNumber },
  });

  if (duplicateReg) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "An NGO with this registration number already exists");
  }

  // 4. Create NGO profile inside a transaction (to handle address creation)
  const ngo = await db.$transaction(async (tx) => {
    let addressRecord = null;

    if (address) {
      addressRecord = await tx.address.create({
        data: {
          line1: address.line1,
          line2: address.line2 || null,
          city: address.city,
          district: address.district || null,
          state: address.state,
          country: address.country || "India", // Default country
          postalCode: address.postalCode,
          latitude: address.latitude || null,
          longitude: address.longitude || null,
        },
      });
    }

    return await tx.nGO.create({
      data: {
        userId: userId!,
        registrationNumber,
        name,
        shortName: shortName || null,
        logo: logo || null,
        coverImage: coverImage || null,
        description: description || null,
        establishmentYear: establishmentYear || null,
        registrationDate: registrationDate ? new Date(registrationDate) : null,
        ngoType: ngoType || null,
        email: email || null,
        phone: phone || null,
        whatsappNumber: whatsappNumber || null,
        website: website || null,
        googleMapUrl: googleMapUrl || null,
        addressId: addressRecord ? addressRecord.id : null,
        registrationCertificate: registrationCertificate || null,
        panCard: panCard || null,
        certificate12A: certificate12A || null,
        certificate80G: certificate80G || null,
        csr1Certificate: csr1Certificate || null,
        fcraNumber: fcraNumber || null,
        fcraCertificate: fcraCertificate || null,
        facebookUrl: facebookUrl || null,
        instagramUrl: instagramUrl || null,
        linkedInUrl: linkedInUrl || null,
        youtubeUrl: youtubeUrl || null,
        twitterUrl: twitterUrl || null,
        founderName: founderName || null,
        presidentName: presidentName || null,
        secretaryName: secretaryName || null,
        treasurerName: treasurerName || null,
        teamMembers: teamMembers ? JSON.parse(JSON.stringify(teamMembers)) : null,
        focusAreas: focusAreas || [],
        operationalAreas: operationalAreas || null,
        beneficiariesServed: beneficiariesServed || null,
        volunteersCount: volunteersCount || null,
      },
      include: {
        address: true,
      },
    });
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "NGO profile created successfully", ngo));
});

/**
 * 2. Get Current NGO Profile (ADMIN or SUBADMIN)
 */
export const getMyNgoProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "User is not authenticated");
  }

  let ngo = null;

  if (userRole === Role.ADMIN) {
    ngo = await db.nGO.findUnique({
      where: { userId },
      include: { address: true },
    });
  } else if (userRole === Role.SUBADMIN) {
    const userNgoId = (req.user as any)?.ngoId;
    if (!userNgoId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Access denied: Subadmin is not associated with any NGO"
      );
    }
    ngo = await db.nGO.findUnique({
      where: { id: userNgoId },
      include: { address: true },
    });
  }

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "NGO profile retrieved successfully", ngo));
});

/**
 * 3. Get All NGOs (Public list with search & pagination)
 */
export const getAllNgos = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  const { search, ngoType, city, state, verificationStatus } = req.query;

  const where: any = {};

  if (verificationStatus) {
    where.verificationStatus = verificationStatus as string;
  }

  if (ngoType) {
    where.ngoType = { equals: ngoType as string, mode: "insensitive" };
  }

  if (city || state) {
    where.address = {};
    if (city) {
      where.address.city = { contains: city as string, mode: "insensitive" };
    }
    if (state) {
      where.address.state = { contains: state as string, mode: "insensitive" };
    }
  }

  if (search) {
    const searchString = search as string;
    where.OR = [
      { name: { contains: searchString, mode: "insensitive" } },
      { shortName: { contains: searchString, mode: "insensitive" } },
      { registrationNumber: { contains: searchString, mode: "insensitive" } },
      { description: { contains: searchString, mode: "insensitive" } },
      { email: { contains: searchString, mode: "insensitive" } },
      { address: { city: { contains: searchString, mode: "insensitive" } } },
      { address: { state: { contains: searchString, mode: "insensitive" } } },
    ];
  }

  const [ngos, total] = await Promise.all([
    db.nGO.findMany({
      where,
      include: {
        address: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.nGO.count({ where }),
  ]);

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "NGOs retrieved successfully", {
      ngos,
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
 * 4. Get NGO Profile By ID (Public)
 */
export const getNgoProfileById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const ngo = await db.nGO.findUnique({
    where: { id },
    include: { address: true },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "NGO profile retrieved successfully", ngo));
});

/**
 * 4. Update NGO Profile (ADMIN owner only)
 */
export const updateNgoProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "User is not authenticated");
  }

  if (userRole !== Role.ADMIN) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: Only Admin can update the NGO profile"
    );
  }

  // Find NGO profile for current Admin
  const ngo = await db.nGO.findUnique({
    where: { userId },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  const {
    // Basic Info
    name,
    shortName,
    logo,
    coverImage,
    description,
    establishmentYear,
    registrationNumber,
    registrationDate,
    ngoType,

    // Contact Info
    email,
    phone,
    whatsappNumber,
    website,
    googleMapUrl,
    address,

    // Legal
    registrationCertificate,
    panCard,
    certificate12A,
    certificate80G,
    csr1Certificate,
    fcraNumber,
    fcraCertificate,

    // Social Media
    facebookUrl,
    instagramUrl,
    linkedInUrl,
    youtubeUrl,
    twitterUrl,

    // Team Information
    founderName,
    presidentName,
    secretaryName,
    treasurerName,
    teamMembers,

    // Work Information
    mission,
    vision,
    focusAreas,
    operationalAreas,
    beneficiariesServed,
    volunteersCount,
  } = req.body;

  // Check registration number uniqueness if changing
  if (registrationNumber && registrationNumber !== ngo.registrationNumber) {
    const duplicateReg = await db.nGO.findUnique({
      where: { registrationNumber },
    });

    if (duplicateReg) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        "An NGO with this registration number already exists"
      );
    }
  }

  const updatedNgo = await db.$transaction(async (tx) => {
    let addressId = ngo.addressId;

    if (address) {
      if (addressId) {
        // Update existing address
        await tx.address.update({
          where: { id: addressId },
          data: {
            line1: address.line1,
            line2: address.line2 !== undefined ? address.line2 : undefined,
            city: address.city,
            district: address.district !== undefined ? address.district : undefined,
            state: address.state,
            country: address.country || undefined,
            postalCode: address.postalCode,
            latitude: address.latitude !== undefined ? address.latitude : undefined,
            longitude: address.longitude !== undefined ? address.longitude : undefined,
          },
        });
      } else {
        // Create new address
        const newAddress = await tx.address.create({
          data: {
            line1: address.line1,
            line2: address.line2 || null,
            city: address.city,
            district: address.district || null,
            state: address.state,
            country: address.country || "India",
            postalCode: address.postalCode,
            latitude: address.latitude || null,
            longitude: address.longitude || null,
          },
        });
        addressId = newAddress.id;
      }
    }

    return await tx.nGO.update({
      where: { id: ngo.id },
      data: {
        registrationNumber: registrationNumber || undefined,
        name: name || undefined,
        shortName: shortName !== undefined ? shortName : undefined,
        logo: logo !== undefined ? logo : undefined,
        coverImage: coverImage !== undefined ? coverImage : undefined,
        description: description !== undefined ? description : undefined,
        establishmentYear: establishmentYear !== undefined ? establishmentYear : undefined,
        registrationDate: registrationDate ? new Date(registrationDate) : undefined,
        ngoType: ngoType !== undefined ? ngoType : undefined,
        email: email !== undefined ? email : undefined,
        phone: phone !== undefined ? phone : undefined,
        whatsappNumber: whatsappNumber !== undefined ? whatsappNumber : undefined,
        website: website !== undefined ? website : undefined,
        googleMapUrl: googleMapUrl !== undefined ? googleMapUrl : undefined,
        registrationCertificate:
          registrationCertificate !== undefined ? registrationCertificate : undefined,
        panCard: panCard !== undefined ? panCard : undefined,
        certificate12A: certificate12A !== undefined ? certificate12A : undefined,
        certificate80G: certificate80G !== undefined ? certificate80G : undefined,
        csr1Certificate: csr1Certificate !== undefined ? csr1Certificate : undefined,
        fcraNumber: fcraNumber !== undefined ? fcraNumber : undefined,
        fcraCertificate: fcraCertificate !== undefined ? fcraCertificate : undefined,
        facebookUrl: facebookUrl !== undefined ? facebookUrl : undefined,
        instagramUrl: instagramUrl !== undefined ? instagramUrl : undefined,
        linkedInUrl: linkedInUrl !== undefined ? linkedInUrl : undefined,
        youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : undefined,
        twitterUrl: twitterUrl !== undefined ? twitterUrl : undefined,
        founderName: founderName !== undefined ? founderName : undefined,
        presidentName: presidentName !== undefined ? presidentName : undefined,
        secretaryName: secretaryName !== undefined ? secretaryName : undefined,
        treasurerName: treasurerName !== undefined ? treasurerName : undefined,
        teamMembers:
          teamMembers !== undefined
            ? teamMembers
              ? JSON.parse(JSON.stringify(teamMembers))
              : null
            : undefined,
        focusAreas: focusAreas !== undefined ? focusAreas : undefined,
        operationalAreas: operationalAreas !== undefined ? operationalAreas : undefined,
        beneficiariesServed: beneficiariesServed !== undefined ? beneficiariesServed : undefined,
        volunteersCount: volunteersCount !== undefined ? volunteersCount : undefined,
        addressId,
      },
      include: {
        address: true,
      },
    });
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "NGO profile updated successfully", updatedNgo));
});

/**
 * 5. Delete NGO Profile (ADMIN owner only)
 */
export const deleteNgoProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "User is not authenticated");
  }

  if (userRole !== Role.ADMIN) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: Only Admin can delete the NGO profile"
    );
  }

  const ngo = await db.nGO.findUnique({
    where: { userId },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  await db.nGO.delete({
    where: { id: ngo.id },
  });

  if (ngo.addressId) {
    await db.address
      .delete({
        where: { id: ngo.addressId },
      })
      .catch(() => {
        // Ignore if address cannot be deleted
      });
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "NGO profile deleted successfully", {}));
});

/**
 * 6. Get Shared NGO Profile by shortName
 */
export const getSharedNgoProfile = asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;

  const ngo = await db.nGO.findFirst({
    where: { shortName: { equals: shortName, mode: "insensitive" } },
    include: { address: true },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Shared NGO profile retrieved", ngo));
});

/**
 * 7. Redirect to Frontend Shared Profile page
 */
export const renderSharedProfileRedirect = asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  return res.redirect(`${clientUrl}/ngo/${shortName}`);
});
