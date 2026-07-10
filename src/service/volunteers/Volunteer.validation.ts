import { z } from "zod";

/**
 * Zod Schema for Public Volunteer Registration (No Login Required)
 */
export const registerVolunteerSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  email: z.string({ message: "Email is required" }).trim().email("Invalid email format"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
  ngoId: z.string({ message: "NGO ID is required" }).uuid("Invalid NGO ID format"),
  skills: z
    .array(z.string().trim().min(1, "Skill description cannot be empty"))
    .default([])
    .optional(),
  availability: z
    .string()
    .trim()
    .max(100, "Availability description cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});

/**
 * Zod Schema for Updating Volunteer Application Status (Admin)
 */
export const updateVolunteerStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"], {
    message: "Status must be PENDING, APPROVED, or REJECTED",
  }),
  notes: z
    .string()
    .trim()
    .max(500, "Admin notes cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});
