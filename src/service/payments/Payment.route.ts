import { Router } from "express";
import { createOrder, verifyPayment } from "./Payment.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createOrderSchema, verifyPaymentSchema } from "./Payment.validation.js";

const router = Router();

// Payment routes require authenticated session
router.post(
  "/create-order",
  authMiddleware as any,
  validate(createOrderSchema),
  createOrder as any
);
router.post(
  "/verify-payment",
  authMiddleware as any,
  validate(verifyPaymentSchema),
  verifyPayment as any
);

export default router;
