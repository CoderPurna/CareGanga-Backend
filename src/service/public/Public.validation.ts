import { z } from "zod";

/**
 * Zod Schema for Notice/Notification ID Validation
 */
export const noticeIdSchema = z.object({
  id: z.string().uuid("Invalid Notice/Notification ID format"),
});

/**
 * Zod Schema for Creating a Public Notice Announcement (Admin Only)
 */
export const createNoticeSchema = z.object({
  ngoId: z.string({ message: "NGO ID is required" }).uuid("Invalid NGO ID format"),
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(3, "Title must be at least 3 characters long")
    .max(150, "Title cannot exceed 150 characters"),
  content: z
    .string({ message: "Content is required" })
    .trim()
    .min(5, "Content must be at least 5 characters long"),
  priority: z.string().trim().default("NORMAL").optional(),
  published: z.boolean().default(true).optional(),
  expiresAt: z
    .string()
    .datetime({ message: "Expiration date must be a valid ISO Date-Time string" })
    .optional()
    .nullable(),
});
