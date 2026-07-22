import { Request, Response } from "express";
import crypto from "crypto";
import { razorpay } from "../../utils/razorpay.js";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { DonationStatus, Role } from "../../generated/prisma/index.js";
import { generateAndSendDonationReceipt } from "../../utils/receipt-generator.js";

/**
 * Helper function to create an Address record inside a transaction if address data is provided.
 */
const createAddressRecord = async (tx: any, addressData?: any) => {
  if (!addressData || (!addressData.line1 && !addressData.city)) return null;
  const newAddress = await tx.address.create({
    data: {
      line1: addressData.line1 || "N/A",
      line2: addressData.line2 || null,
      city: addressData.city || "N/A",
      district: addressData.district || null,
      state: addressData.state || "N/A",
      country: addressData.country || "India",
      postalCode: addressData.postalCode || "000000",
    },
  });
  return newAddress.id;
};

/**
 * Helper function to resolve or create a donor user profile.
 */
const getOrCreateDonorUser = async (
  reqUser: any,
  email?: string,
  fullName?: string,
  mobile?: string
): Promise<string> => {
  if (reqUser?.id) {
    return reqUser.id;
  }

  if (!email || !fullName || !mobile) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "Guest donations require email, fullName, and mobile fields"
    );
  }

  // Find or create donor user
  let user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    const mockPassword = crypto.randomBytes(16).toString("hex");
    user = await db.user.create({
      data: {
        name: fullName,
        email,
        phone: mobile,
        password: mockPassword,
        role: Role.DONOR,
      },
    });
  } else {
    // If user exists and doesn't have phone, update it safely if phone is not taken
    const updateData: any = {};
    if (!user.phone && mobile) {
      const phoneTaken = await db.user.findFirst({
        where: { phone: mobile, NOT: { id: user.id } },
      });
      if (!phoneTaken) {
        updateData.phone = mobile;
      }
    }
    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.SUBADMIN &&
      user.role !== Role.VOLUNTEER &&
      user.role !== Role.MEMBER &&
      user.role !== Role.COMPANY
    ) {
      updateData.role = Role.DONOR;
    }
    if (Object.keys(updateData).length > 0) {
      user = await db.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  return user.id;
};

/**
 * 1. Create Razorpay Order
 * Endpoint: POST /api/v1/payments/create-order
 */
export const createOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { campaignId, amount, email, fullName, mobile } = req.body;

  // Resolve user (logged-in or guest)
  const resolvedUserId = await getOrCreateDonorUser(req.user, email, fullName, mobile);

  // Verify campaign exists and is active (if campaignId is provided)
  if (campaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
    }
  }

  // Razorpay expects amount in paise (multiply INR by 100)
  const amountInPaise = Math.round(amount * 100);

  const options = {
    amount: amountInPaise,
    currency: "INR",
    receipt: `receipt_don_${campaignId ? campaignId.substring(0, 10) : "direct"}_${Date.now()}`,
    notes: {
      campaignId: campaignId || null,
      userId: resolvedUserId,
    },
  };

  try {
    const order = await razorpay.orders.create(options);

    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, "Razorpay order created successfully", {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      })
    );
  } catch (error: any) {
    console.error("Razorpay order creation failed: ", error);
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error?.message || "Failed to create payment order with Razorpay"
    );
  }
});

/**
 * 2. Verify Razorpay Payment Signature and Save Donation
 * Endpoint: POST /api/v1/payments/verify-payment
 */
export const verifyPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    campaignId,
    amount,
    anonymous = false,
    message,
    email,
    fullName,
    mobile,
    address,
  } = req.body;

  // Resolve user (logged-in or guest)
  const resolvedUserId = await getOrCreateDonorUser(req.user, email, fullName, mobile);

  // 1. Verify payment signature
  const secret = process.env.RAZORPAY_KEY_SECRET || "rzp_test_placeholder_secret";
  const signString = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signString.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Payment verification failed: Invalid signature");
  }

  // 2. Prevent duplicate payment processing by checking if transactionId is already used
  const existingDonation = await db.donation.findUnique({
    where: { transactionId: razorpay_payment_id },
  });

  if (existingDonation) {
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, "Payment already processed and registered", {
        donation: existingDonation,
      })
    );
  }

  // 3. Check for corporate company association
  const companyProfile = await db.company.findUnique({
    where: { userId: resolvedUserId },
  });

  // 4. Create Payment and Donation records in a single database transaction
  const result = await db.$transaction(async (tx) => {
    // Create address record if address details are provided
    const addressId = await createAddressRecord(tx, address);

    // Create payment entry
    const payment = await tx.payment.create({
      data: {
        userId: resolvedUserId,
        amount,
        currency: "INR",
        gateway: "razorpay",
        gatewayTransactionId: razorpay_payment_id,
        status: DonationStatus.SUCCESS,
      },
    });

    // Create donation entry
    const donation = await tx.donation.create({
      data: {
        campaignId: campaignId || null,
        userId: resolvedUserId,
        companyId: companyProfile ? companyProfile.id : null,
        addressId: addressId || null,
        amount,
        currency: "INR",
        paymentMethod: "razorpay",
        paymentStatus: DonationStatus.SUCCESS,
        transactionId: razorpay_payment_id,
        anonymous,
        message: message || null,
      },
      include: {
        campaign: {
          select: {
            title: true,
          },
        },
        address: true,
      },
    });

    return { payment, donation };
  });

  // Asynchronously generate filled payment receipt image and email it to the user
  generateAndSendDonationReceipt(result.donation.id).catch((err) => {
    console.error("Failed to generate and send donation receipt: ", err);
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Payment verified and donation registered successfully",
        result
      )
    );
});

/**
 * 3. Simulate Successful Payment (Dev Mode Only)
 * Endpoint: POST /api/v1/payments/simulate-success
 */
export const simulateSuccess = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { campaignId, amount, anonymous = false, message, email, fullName, mobile, address } = req.body;

  // Resolve user (logged-in or guest)
  const resolvedUserId = await getOrCreateDonorUser(req.user, email, fullName, mobile);

  // Verify campaign exists (if campaignId is provided)
  if (campaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
    }
  }

  const mockTransactionId = `mock_txn_${Date.now()}_${Math.round(Math.random() * 1e6)}`;

  // Find corporate company association
  const companyProfile = await db.company.findUnique({
    where: { userId: resolvedUserId },
  });

  const result = await db.$transaction(async (tx) => {
    // Create address record if address details are provided
    const addressId = await createAddressRecord(tx, address);

    const payment = await tx.payment.create({
      data: {
        userId: resolvedUserId,
        amount,
        currency: "INR",
        gateway: "simulated_gateway",
        gatewayTransactionId: mockTransactionId,
        status: DonationStatus.SUCCESS,
      },
    });

    const donation = await tx.donation.create({
      data: {
        campaignId: campaignId || null,
        userId: resolvedUserId,
        companyId: companyProfile ? companyProfile.id : null,
        addressId: addressId || null,
        amount,
        currency: "INR",
        paymentMethod: "simulated",
        paymentStatus: DonationStatus.SUCCESS,
        transactionId: mockTransactionId,
        anonymous,
        message: message || null,
      },
      include: {
        campaign: {
          select: {
            title: true,
          },
        },
        address: true,
      },
    });

    return { payment, donation };
  });

  // Asynchronously generate filled payment receipt image and email it to the user
  generateAndSendDonationReceipt(result.donation.id).catch((err) => {
    console.error("Failed to generate and send donation receipt: ", err);
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(
      new ApiResponse(
        HTTP_STATUS.CREATED,
        "Development payment simulation successful and donation registered",
        result
      )
    );
});

/**
 * 4. Get Printable Receipt Details
 * Endpoint: GET /api/v1/payments/receipt/:id
 */
export const getReceiptPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const donationId = req.params.id as string;

  const donation = await db.donation.findUnique({
    where: { id: donationId },
    include: {
      campaign: {
        include: {
          ngo: {
            select: {
              name: true,
              registrationNumber: true,
              certificate80G: true,
            },
          },
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!donation) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Donation record not found");
  }

  const isOwner = donation.userId === req.user?.id;
  const isAdmin = req.user?.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: You are not authorized to view this receipt"
    );
  }

  const receiptDetails = {
    receiptNumber: `REC-${donation.id.substring(0, 8).toUpperCase()}`,
    date: donation.donatedAt,
    donorName: donation.anonymous && !isAdmin ? "Anonymous Donor" : (donation as any).user.name,
    donorEmail: donation.anonymous && !isAdmin ? "N/A" : (donation as any).user.email,
    campaignTitle: donation.campaign?.title || "Direct Donation",
    ngoName: donation.campaign?.ngo.name || "CareGanga NGO",
    ngoRegistration: donation.campaign?.ngo.registrationNumber || "N/A",
    amount: donation.amount,
    currency: donation.currency,
    paymentMethod: donation.paymentMethod,
    transactionId: donation.transactionId,
    status: donation.paymentStatus,
    is80GEligible: donation.campaign ? !!donation.campaign.ngo.certificate80G : true,
    certificate80G: donation.campaign?.ngo.certificate80G || "N/A",
  };

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Receipt details fetched successfully", receiptDetails));
});

/**
 * 5. Get All Donations (Admin Dashboard)
 * Endpoint: GET /api/v1/payments/admin/donations
 */
export const getAllDonationsAdmin = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const total = await db.donation.count();
    const donations = await db.donation.findMany({
      skip,
      take: limit,
      include: {
        campaign: {
          select: {
            title: true,
            ngo: {
              select: { name: true },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { donatedAt: "desc" },
    });

    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, "All donations fetched successfully for admin", {
        donations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  }
);

/**
 * 6. Get My Donations (Donor History)
 * Endpoint: GET /api/v1/payments/my-donations
 */
export const getMyDonationsDonor = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
    }

    const donations = await db.donation.findMany({
      where: { userId },
      include: {
        campaign: {
          select: {
            title: true,
            thumbnail: true,
          },
        },
      },
      orderBy: { donatedAt: "desc" },
    });

    return res
      .status(HTTP_STATUS.OK)
      .json(new ApiResponse(HTTP_STATUS.OK, "Donor history fetched successfully", donations));
  }
);

/**
 * 7. Get Donation Stats (Admin Panel Summary)
 * Endpoint: GET /api/v1/payments/admin/stats
 */
export const getDonationStatsAdmin = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    // Aggregate stats
    const totalAmountResult = await db.donation.aggregate({
      where: { paymentStatus: DonationStatus.SUCCESS },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Unique donors count
    const uniqueDonorsResult = await db.donation.groupBy({
      by: ["userId"],
      where: { paymentStatus: DonationStatus.SUCCESS },
    });

    const stats = {
      totalRevenue: totalAmountResult._sum.amount || 0,
      totalDonationsCount: totalAmountResult._count.id || 0,
      uniqueDonorsCount: uniqueDonorsResult.length,
      currency: "INR",
    };

    return res
      .status(HTTP_STATUS.OK)
      .json(new ApiResponse(HTTP_STATUS.OK, "Donation analytics retrieved successfully", stats));
  }
);

/**
 * 8. Refund Donation (Admin Only)
 * Endpoint: POST /api/v1/payments/admin/refund
 */
export const refundDonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { paymentId, amount } = req.body;

  // 1. Fetch target Donation
  const donation = await db.donation.findUnique({
    where: { id: paymentId },
  });

  if (!donation) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Donation record not found");
  }

  if (donation.paymentStatus === DonationStatus.REFUNDED) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "This donation has already been refunded");
  }

  if (donation.paymentStatus !== DonationStatus.SUCCESS) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Only successful donations can be refunded");
  }

  // 2. Perform Razorpay Refund request if simulated payment is not being used
  let razorpayRefund = null;
  if (donation.paymentMethod === "razorpay" && donation.transactionId) {
    try {
      const refundOptions: any = {};
      if (amount) {
        refundOptions.amount = Math.round(amount * 100); // in paise
      }
      razorpayRefund = await (razorpay.payments as any).refund(
        donation.transactionId,
        refundOptions
      );
    } catch (error: any) {
      console.error("Razorpay refund creation failed: ", error);
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error?.message || "Failed to process refund with Razorpay"
      );
    }
  }

  // 3. Update status in Database inside a transaction
  const result = await db.$transaction(async (tx) => {
    const updatedDonation = await tx.donation.update({
      where: { id: paymentId },
      data: {
        paymentStatus: DonationStatus.REFUNDED,
      },
    });

    const updatedPayment = await tx.payment.updateMany({
      where: { gatewayTransactionId: donation.transactionId },
      data: {
        status: DonationStatus.REFUNDED,
      },
    });

    return { donation: updatedDonation, payment: updatedPayment, razorpayRefund };
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Donation refunded successfully", result));
});
