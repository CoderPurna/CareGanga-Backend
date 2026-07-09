import { Router } from "express";
import {
  signup,
  login,
  logoutUser,
  refreshAccessToken,
  getUser,
  updateUser,
} from "./User.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { signupSchema, loginSchema, updateUserSchema } from "./User.validation.js";

const router = Router();

// Public routes
router.post("/register", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);
router.post("/refresh-token", refreshAccessToken);

// Protected routes (require valid access token)
router.post("/logout", authMiddleware as any, logoutUser as any);
router.get("/me", authMiddleware as any, getUser as any);
router.patch("/update-account", authMiddleware as any, validate(updateUserSchema), updateUser as any);

export default router;
