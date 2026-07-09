import { Router } from "express";
import {
  createCampaign,
  getAllCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
} from "./Campaign.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createCampaignSchema, updateCampaignSchema } from "./Campaign.validation.js";

const router = Router();

// Public routes
router.get("/", getAllCampaigns);
router.get("/:id", getCampaign);

// Protected routes (NGO-only operations, ownership verified in controller)
router.post("/", authMiddleware as any, validate(createCampaignSchema), createCampaign as any);
router.put("/:id", authMiddleware as any, validate(updateCampaignSchema), updateCampaign as any);
router.delete("/:id", authMiddleware as any, deleteCampaign as any);

export default router;
