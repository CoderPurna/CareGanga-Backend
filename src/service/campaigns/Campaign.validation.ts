import { z } from "zod";
import { CampaignStatus } from "../../generated/prisma/index.js";

/**
 * Schema for Creating a Campaign
 */
export const createCampaignSchema = z
  .object({
    title: z
      .string({ message: "Title is required" })
      .trim()
      .min(3, "Title must be at least 3 characters long")
      .max(150, "Title cannot exceed 150 characters"),
    description: z
      .string({ message: "Description is required" })
      .trim()
      .min(10, "Description must be at least 10 characters long"),
    goalAmount: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((val) => !isNaN(val) && val > 0, {
        message: "Goal amount must be a positive number",
      }),
    startDate: z
      .string({ message: "Start date is required" })
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Please provide a valid start date",
      }),
    endDate: z
      .string({ message: "End date is required" })
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Please provide a valid end date",
      }),
    thumbnail: z.string().trim().optional(),
    banner: z.string().trim().optional(),
    status: z
      .nativeEnum(CampaignStatus, { message: "Invalid campaign status selected" })
      .optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

/**
 * Schema for Updating a Campaign
 */
export const updateCampaignSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters long")
      .max(150, "Title cannot exceed 150 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters long")
      .optional(),
    goalAmount: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((val) => !isNaN(val) && val > 0, {
        message: "Goal amount must be a positive number",
      })
      .optional(),
    startDate: z
      .string()
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Please provide a valid start date",
      })
      .optional(),
    endDate: z
      .string()
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Please provide a valid end date",
      })
      .optional(),
    thumbnail: z.string().trim().optional(),
    banner: z.string().trim().optional(),
    status: z
      .nativeEnum(CampaignStatus, { message: "Invalid campaign status selected" })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate > data.startDate;
      }
      return true;
    },
    {
      message: "End date must be after the start date",
      path: ["endDate"],
    }
  );
