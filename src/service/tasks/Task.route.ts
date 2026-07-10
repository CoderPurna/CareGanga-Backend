import { Router } from "express";
import {
  getUserTasks,
  createTask,
  getTaskDetails,
  updateTask,
  deleteTask,
  completeTask,
  calendarViewTasks,
  getTodayTasks,
  getUpcomingTasks,
} from "./Task.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { createTaskSchema, updateTaskSchema } from "./Task.validation.js";

const router = Router();

// All task routes require authenticated sessions (NGO Admins and Subadmins)
router.use(authMiddleware as any);

router.get("/", getUserTasks as any);
router.post("/", validate(createTaskSchema), createTask as any);

router.get("/calendar", calendarViewTasks as any);
router.get("/today", getTodayTasks as any);
router.get("/upcoming", getUpcomingTasks as any);

router.get("/:id", getTaskDetails as any);
router.put("/:id", validate(updateTaskSchema), updateTask as any);
router.delete("/:id", deleteTask as any);
router.patch("/:id/complete", completeTask as any);

export default router;
