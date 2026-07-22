import { Router } from "express";
import {
  createNgoProfile,
  getMyNgoProfile,
  getNgoProfileById,
  getAllNgos,
  updateNgoProfile,
  deleteNgoProfile,
  getSharedNgoProfile,
  renderSharedProfileRedirect,
} from "./NGO.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { createNgoSchema, updateNgoSchema } from "./NGO.validation.js";

const router = Router();

// Public routes
router.get("/", getAllNgos);
router.get("/:id", getNgoProfileById);
router.get("/share/:shortName", getSharedNgoProfile as any);
router.get("/share/redirect/:shortName", renderSharedProfileRedirect as any);

// Protected routes (require valid access token)
router.post("/", authMiddleware as any, validate(createNgoSchema), createNgoProfile as any);
router.get("/me", authMiddleware as any, getMyNgoProfile as any);
router.patch("/me", authMiddleware as any, validate(updateNgoSchema), updateNgoProfile as any);
router.delete("/me", authMiddleware as any, deleteNgoProfile as any);

export default router;
