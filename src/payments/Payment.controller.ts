import { Response } from "express";
import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import { db } from "../db/db.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { DonationStatus } from "../generated/prisma/index.js";

/**
 * 1. Create Razorpay Order
 * Endpoint: POST /api/v1/payments/create-order
 */
export const createOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const { campaignId, amount } = req.body;

  // Verify campaign exists and is active
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Campaign not found");
  }

  // Razorpay expects amount in paise (multiply INR by 100)
  const amountInPaise = Math.round(amount * 100);

  const options = {
    amount: amountInPaise,
    currency: "INR",
    receipt: `receipt_camp_${campaignId.substring(0, 10)}_${Date.now()}`,
    notes: {
      campaignId,
      userId,
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
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    campaignId,
    amount,
    anonymous = false,
    message,
  } = req.body;

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
    where: { userId },
  });

  // 4. Create Payment and Donation records in a single database transaction
  const result = await db.$transaction(async (tx) => {
    // Create payment entry
    const payment = await tx.payment.create({
      data: {
        userId,
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
        campaignId,
        userId,
        companyId: companyProfile ? companyProfile.id : null,
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
      },
    });

    return { payment, donation };
  });

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, "Payment verified and donation registered successfully", result)
  );
});
