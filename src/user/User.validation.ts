import { z } from "zod";
import { Role } from "../generated/prisma/index.js";
import { VALIDATION_PATTERNS } from "../utils/constants.js";

/**
 * Schema for User Signup / Registration
 */
export const signupSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit Indian phone number")
    .optional()
    .or(z.literal("")),
  password: z
    .string({ message: "Password is required" })
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters"),
  role: z.nativeEnum(Role, { message: "Invalid role selected" }).optional(),
});

/**
 * Schema for User Login
 */
export const loginSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  password: z.string({ message: "Password is required" }).min(1, "Password is required"),
});

/**
 * Schema for User Profile Update
 */
export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit Indian phone number")
      .optional()
      .or(z.literal("")),
    avatar: z.string().trim().optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.phone !== undefined || data.avatar !== undefined,
    {
      message: "At least one field (name, phone, avatar) is required to update",
      path: [], // Attach error to the root object
    }
  );

/**
 * Schema for Creating a Subadmin (exclusively by Admin)
 */
export const createSubadminSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit Indian phone number")
    .optional()
    .or(z.literal("")),
  password: z
    .string({ message: "Password is required" })
    .min(8, "Password must be at least 8 characters long"),
  permissions: z
    .object({
      dashboard: z.boolean().optional().default(false),
      donations: z.boolean().optional().default(false),
      volunteers: z.boolean().optional().default(false),
      campaigns: z.boolean().optional().default(false),
      deleteCampaigns: z.boolean().optional().default(false),
      payments: z.boolean().optional().default(false),
      receipts: z.boolean().optional().default(false),
      reports: z.boolean().optional().default(false),
    })
    .default({
      dashboard: false,
      donations: false,
      volunteers: false,
      campaigns: false,
      deleteCampaigns: false,
      payments: false,
      receipts: false,
      reports: false,
    }),
});
