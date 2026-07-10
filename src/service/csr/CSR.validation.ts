import { z } from "zod";

/**
 * Zod Schema for Submitting a CSR Request (Public)
 */
export const submitCsrRequestSchema = z.object({
  companyId: z.string({ message: "Company ID is required" }).uuid("Invalid Company ID format"),
  ngoId: z.string({ message: "NGO ID is required" }).uuid("Invalid NGO ID format"),
  subject: z
    .string({ message: "Subject is required" })
    .trim()
    .min(5, "Subject must be at least 5 characters long")
    .max(150, "Subject cannot exceed 150 characters"),
  description: z
    .string({ message: "Description is required" })
    .trim()
    .min(10, "Description must be at least 10 characters long")
    .max(2000, "Description cannot exceed 2000 characters"),
});

/**
 * Zod Schema for Updating CSR Request Status (Admin)
 */
export const updateCsrStatusSchema = z.object({
  status: z
    .string({ message: "Status is required" })
    .trim()
    .min(1, "Status cannot be empty")
    .max(50, "Status cannot exceed 50 characters"),
});
