import { Router } from "express";
import {
  createNgoProfile,
  getMyNgoProfile,
  getNgoProfileById,
  updateNgoProfile,
  deleteNgoProfile,
} from "./NGO.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createNgoSchema, updateNgoSchema } from "./NGO.validation.js";

const router = Router();

// Public routes
router.get("/:id", getNgoProfileById);

// Protected routes (require valid access token)
router.post("/", authMiddleware as any, validate(createNgoSchema), createNgoProfile as any);
router.get("/me", authMiddleware as any, getMyNgoProfile as any);
router.patch("/me", authMiddleware as any, validate(updateNgoSchema), updateNgoProfile as any);
router.delete("/me", authMiddleware as any, deleteNgoProfile as any);

export default router;
