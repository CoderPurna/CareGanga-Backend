import { z } from "zod";

/**
 * Zod Schema for Dashboard Global Search
 */
export const globalSearchSchema = z.object({
  q: z
    .string({ message: "Search query is required" })
    .trim()
    .min(1, "Search query must be at least 1 character long"),
});

/**
 * Zod Schema for Bulk Quick Actions
 */
export const bulkQuickActionsSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "DELETE"], {
    message: "Action must be APPROVE, REJECT, or DELETE",
  }),
  entity: z.enum(["VOLUNTEER", "CAMPAIGN", "NGO"], {
    message: "Entity must be VOLUNTEER, CAMPAIGN, or NGO",
  }),
  ids: z.array(z.string().uuid("Invalid ID format")).min(1, "At least one ID is required"),
});

/**
 * Zod Schema for Exporting Data
 */
export const exportDataSchema = z.object({
  format: z.enum(["json", "csv"], {
    message: "Format must be json or csv",
  }),
  entity: z.enum(["donations", "campaigns", "volunteers", "ngos"], {
    message: "Entity must be donations, campaigns, volunteers, or ngos",
  }),
});
