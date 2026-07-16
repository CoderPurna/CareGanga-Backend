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
    .string({ message: "Description is required" })
    .trim()
    .min(2, "Description must be at least 2 characters long")
    .max(500, "Description cannot exceed 500 characters"),
  price: z
    .number({ message: "Price is required" })
    .nonnegative("Price must be a non-negative number"),
  duration: z
    .number({ message: "Duration is required" })
    .int("Duration must be a whole number of days")
    .positive("Duration must be at least 1 day"),
  benefits: z
    .array(z.string().trim().min(1, "Benefit cannot be empty"), {
      message: "Benefits array is required",
    })
    .min(1, "At least one benefit must be specified"),
});

/**
 * Zod Schema for Updating a Membership Tier (Admin)
 */
export const updateTierSchema = createTierSchema.partial();

/**
 * Address validation sub-schema
 */
const addressSchema = z.object({
  streetAddress: z.string({ message: "Street address is required" }).trim().min(2),
  city: z.string({ message: "City/Town is required" }).trim().min(2),
  state: z.string({ message: "State is required" }).trim().min(2),
  pinCode: z
    .string({ message: "PIN Code is required" })
    .trim()
    .regex(/^[0-9]{6}$/, "PIN Code must be exactly 6 digits"),
});

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
  fullName: z
    .string({ message: "Full Name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters long"),
  dob: z.string({ message: "Date of Birth is required" }).trim(),
  gender: z.string({ message: "Gender is required" }).trim().min(1, "Gender must be specified"),
  mobile: z
    .string({ message: "Mobile number is required" })
    .trim()
    .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),
  email: z.string({ message: "Email is required" }).trim().email("Invalid email format"),
  permanentAddress: addressSchema,
  billingAddress: addressSchema.optional().or(z.null()),
  sameAsPermanent: z.boolean({ message: "sameAsPermanent flag is required" }),
  profileImage: z.string({ message: "Profile image URL is required" }).url("Invalid profile image URL"),
  supportingDocument: z.string({ message: "Supporting document URL is required" }).url("Invalid supporting document URL"),
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
