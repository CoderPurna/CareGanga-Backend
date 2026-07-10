import { Router } from "express";
import {
  createDonation,
  getDonationsList,
  getDonationDetails,
  updateDonationStatus,
  getDonationAnalytics,
} from "./Donation.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { createDonationSchema, updateDonationStatusSchema } from "./Donation.validation.js";

const router = Router();

// All donation routes are protected
router.post("/", authMiddleware as any, validate(createDonationSchema), createDonation as any);
router.get("/", authMiddleware as any, getDonationsList as any);
router.get("/analytics/summary", authMiddleware as any, getDonationAnalytics as any);
router.get("/:id", authMiddleware as any, getDonationDetails as any);
router.put(
  "/:id/status",
  authMiddleware as any,
  validate(updateDonationStatusSchema),
  updateDonationStatus as any
);

export default router;
