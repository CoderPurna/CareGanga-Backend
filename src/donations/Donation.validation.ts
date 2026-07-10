import { z } from "zod";

/**
 * Zod Schema for Creating a Donation
 */
export const createDonationSchema = z.object({
  campaignId: z
    .string({ message: "Campaign ID is required" })
    .uuid("Invalid Campaign ID format"),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Donation amount must be a positive number")
    .min(1, "Donation amount must be at least 1 INR"),
  currency: z
    .string()
    .trim()
    .min(3, "Currency must be 3 characters (e.g. INR)")
    .max(3)
    .default("INR")
    .optional(),
  paymentMethod: z
    .string({ message: "Payment method is required" })
    .trim()
    .min(2, "Payment method is required"),
  transactionId: z
    .string({ message: "Transaction ID is required" })
    .trim()
    .min(3, "Transaction ID must be at least 3 characters long"),
  anonymous: z
    .boolean()
    .default(false)
    .optional(),
  message: z
    .string()
    .trim()
    .max(500, "Message cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});

/**
 * Zod Schema for Updating Donation Status
 */
export const updateDonationStatusSchema = z.object({
  paymentStatus: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"], {
    message: "Invalid donation status. Must be PENDING, SUCCESS, FAILED, or REFUNDED",
  }),
});
