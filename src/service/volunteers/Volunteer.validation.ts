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
    .string({ message: "Phone number is required" })
    .trim()
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
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
  profilePhoto: z.string({ message: "Profile photo is required" }).url("Invalid profile photo URL"),
  dob: z.string({ message: "Date of birth is required" }).trim(),
  gender: z.string({ message: "Gender is required" }).trim().min(1, "Gender must be specified"),
  bloodGroup: z.string().optional().or(z.literal("")),
  streetAddress: z
    .string({ message: "Street address is required" })
    .trim()
    .min(2, "Street address must be at least 2 characters"),
  pinCode: z
    .string({ message: "PIN Code is required" })
    .trim()
    .regex(/^[0-9]{6}$/, "PIN Code must be exactly 6 digits"),
  city: z
    .string({ message: "City/Town is required" })
    .trim()
    .min(2, "City/Town must be at least 2 characters"),
  state: z
    .string({ message: "State is required" })
    .trim()
    .min(2, "State must be at least 2 characters"),
  documentUrl: z.string({ message: "Document image/PDF URL is required" }).url("Invalid document URL"),
  idType: z.enum(["AADHAAR", "VOTER_ID"]).default("AADHAAR"),

  // Future suggestions
  occupation: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
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
