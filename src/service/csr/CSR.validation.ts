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

/**
 * Zod Schema for Corporate / Company Registration (Public)
 */
export const registerCompanySchema = z.object({
  name: z.string({ message: "Company name is required" }).trim().min(2, "Company name must be at least 2 characters"),
  website: z.string({ message: "Company website URL is required" }).trim().url("Invalid website URL"),
  cinNumber: z.string().trim().optional().or(z.null()).or(z.literal("")),
  pocName: z.string({ message: "Point of contact name is required" }).trim().min(2, "POC name must be at least 2 characters"),
  pocDesignation: z.string({ message: "Point of contact designation is required" }).trim().min(2, "POC designation must be at least 2 characters"),
  email: z.string({ message: "Official email address is required" }).trim().email("Invalid email format"),
  phone: z
    .string({ message: "Contact number is required" })
    .trim()
    .regex(/^[0-9]{10}$/, "Contact number must be exactly 10 digits"),
  registeredAddress: z.string({ message: "Corporate registered address is required" }).trim().min(5, "Address must be at least 5 characters"),
  areasOfInterest: z
    .array(z.string().trim().min(1), { message: "Areas of interest are required" })
    .min(1, "Specify at least one area of interest"),
  partnershipTypes: z
    .array(z.string().trim().min(1), { message: "Partnership types are required" })
    .min(1, "Specify at least one partnership type"),
  projectedBudget: z.string().trim().optional().or(z.null()).or(z.literal("")),
  proposalSummary: z
    .string({ message: "Brief message / proposal summary is required" })
    .trim()
    .min(20, "Proposal summary must be at least 20 characters long"),
});
