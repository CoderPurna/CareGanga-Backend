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
import { checkPermission } from "../middlewares/permission.middleware.js";
import { createCampaignSchema, updateCampaignSchema } from "./Campaign.validation.js";

const router = Router();

// Public routes
router.get("/", getAllCampaigns);
router.get("/:id", getCampaign);

// Protected routes with fine-grained subadmin permission checks
router.post(
  "/",
  authMiddleware as any,
  checkPermission("campaigns"),
  validate(createCampaignSchema),
  createCampaign as any
);
router.put(
  "/:id",
  authMiddleware as any,
  checkPermission("campaigns"),
  validate(updateCampaignSchema),
  updateCampaign as any
);
router.delete(
  "/:id",
  authMiddleware as any,
  checkPermission("deleteCampaigns"),
  deleteCampaign as any
);

export default router;
