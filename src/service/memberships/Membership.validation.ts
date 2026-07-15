import { z } from "zod";

/**
 * Zod Schema for Creating a Membership Tier (Admin)
 */
export const createTierSchema = z.object({
  name: z
    .string({ message: "Tier name is required" })
    .trim()
    .min(2, "Tier name must be at least 2 characters long")
    .max(100, "Tier name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  price: z
    .number({ message: "Price is required" })
    .nonnegative("Price must be a non-negative number"),
  duration: z
    .number({ message: "Duration is required" })
    .int("Duration must be a whole number of days")
    .positive("Duration must be at least 1 day"),
  benefits: z.array(z.string().trim().min(1, "Benefit cannot be empty")).default([]).optional(),
});

/**
 * Zod Schema for Updating a Membership Tier (Admin)
 */
export const updateTierSchema = createTierSchema.partial();

/**
 * Zod Schema for Applying for a Membership (Public)
 */
export const applyMembershipSchema = z.object({
  ngoId: z
    .string()
    .uuid("Invalid NGO ID format")
    .optional()
    .or(z.literal(""))
    .or(z.literal("guest"))
    .or(z.null()),
  tierId: z.string({ message: "Tier ID is required" }).uuid("Invalid Tier ID format"),
  fullName: z.string().optional().or(z.null()),
  dob: z.string().optional().or(z.null()),
  gender: z.string().optional().or(z.null()),
  mobile: z.string().optional().or(z.null()),
  email: z.string().optional().or(z.null()),
  address: z.string().optional().or(z.null()),
  idType: z.string().optional().or(z.null()),
  remarks: z
    .string()
    .trim()
    .max(1000, "Remarks cannot exceed 1000 characters")
    .optional()
    .or(z.literal("")),
});

/**
 * Zod Schema for Verifying a Membership Payment (Public)
 */
export const verifyMembershipPaymentSchema = z.object({
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
  applicationId: z
    .string({ message: "Application ID is required" })
    .uuid("Invalid Application ID format"),
});

/**
 * Zod Schema for Updating an Application Status (Admin)
 */
export const updateApplicationStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "EXPIRED", "CANCELLED"], {
    message: "Invalid membership status. Must be PENDING, ACTIVE, EXPIRED, or CANCELLED",
  }),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});
