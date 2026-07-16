import { z } from "zod";

/**
 * Zod Schema for Creating a Razorpay Order
 */
export const createOrderSchema = z.object({
  campaignId: z
    .string()
    .uuid("Invalid Campaign ID format")
    .optional()
    .or(z.null())
    .or(z.literal("")),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be a positive number")
    .min(1, "Amount must be at least 1 INR"),
  email: z.string().trim().email("Invalid email format").optional().or(z.null()).or(z.literal("")),
  fullName: z.string().trim().optional().or(z.null()).or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits")
    .optional()
    .or(z.null())
    .or(z.literal("")),
});

/**
 * Zod Schema for Verifying a Razorpay Payment Signature
 */
export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z
    .string({ message: "Razorpay payment ID is required" })
    .trim()
    .min(1, "Razorpay payment ID cannot be empty"),
  razorpay_order_id: z
    .string({ message: "Razorpay order ID is required" })
    .trim()
    .min(1, "Razorpay order ID cannot be empty"),
  razorpay_signature: z
    .string({ message: "Razorpay signature is required" })
    .trim()
    .min(1, "Razorpay signature cannot be empty"),
  campaignId: z
    .string()
    .uuid("Invalid Campaign ID format")
    .optional()
    .or(z.null())
    .or(z.literal("")),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be a positive number")
    .min(1, "Amount must be at least 1 INR"),
  anonymous: z.boolean().default(false).optional(),
  message: z
    .string()
    .trim()
    .max(500, "Message cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Invalid email format").optional().or(z.null()).or(z.literal("")),
  fullName: z.string().trim().optional().or(z.null()).or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits")
    .optional()
    .or(z.null())
    .or(z.literal("")),
});

/**
 * Zod Schema for Simulating a Successful Payment (Dev)
 */
export const simulateSuccessSchema = z.object({
  campaignId: z
    .string()
    .uuid("Invalid Campaign ID format")
    .optional()
    .or(z.null())
    .or(z.literal("")),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be a positive number")
    .min(1, "Amount must be at least 1 INR"),
  anonymous: z.boolean().default(false).optional(),
  message: z
    .string()
    .trim()
    .max(500, "Message cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Invalid email format").optional().or(z.null()).or(z.literal("")),
  fullName: z.string().trim().optional().or(z.null()).or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits")
    .optional()
    .or(z.null())
    .or(z.literal("")),
});

/**
 * Zod Schema for Requesting a Refund
 */
export const refundPaymentSchema = z.object({
  paymentId: z.string({ message: "Payment ID is required" }).uuid("Invalid Payment ID format"),
  amount: z.number().positive("Refund amount must be positive").optional(),
});
