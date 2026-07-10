import { z } from "zod";

/**
 * Zod Schema for Creating a Task (Protected)
 */
export const createTaskSchema = z.object({
  ngoId: z.string({ message: "NGO ID is required" }).uuid("Invalid NGO ID format"),
  assignedTo: z.string().uuid("Invalid Assigned User ID format").optional().nullable(),
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(3, "Title must be at least 3 characters long")
    .max(150, "Title cannot exceed 150 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .nullable(),
  priority: z
    .string()
    .trim()
    .max(50, "Priority cannot exceed 50 characters")
    .default("NORMAL")
    .optional(),
  dueDate: z
    .string()
    .datetime({ message: "Due date must be a valid ISO Date-Time string" })
    .optional()
    .nullable(),
});

/**
 * Zod Schema for Updating a Task (Protected)
 */
export const updateTaskSchema = createTaskSchema.partial();

/**
 * Zod Schema for Updating Task Status (Protected)
 */
export const updateTaskStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"], {
    message: "Status must be TODO, IN_PROGRESS, or DONE",
  }),
});
