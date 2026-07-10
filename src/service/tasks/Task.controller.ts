import { Response } from "express";
import { db } from "../../db/db.js";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { TaskStatus } from "../../generated/prisma/index.js";

/**
 * 1. Get User Tasks (Assigned to current user)
 * Endpoint: GET /api/v1/tasks
 */
export const getUserTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const tasks = await db.task.findMany({
    where: { assignedTo: userId },
    include: {
      ngo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "User tasks fetched successfully", tasks));
});

/**
 * 2. Create Task (NGO Admin / Subadmin assigns tasks)
 * Endpoint: POST /api/v1/tasks
 */
export const createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ngoId, assignedTo, title, description, priority = "NORMAL", dueDate } = req.body;

  // Verify NGO profile exists
  const ngo = await db.nGO.findUnique({
    where: { id: ngoId },
  });

  if (!ngo) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "NGO profile not found");
  }

  // If assignedTo is passed, verify target User exists
  if (assignedTo) {
    const assignedUser = await db.user.findUnique({
      where: { id: assignedTo },
    });
    if (!assignedUser) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Assigned user not found");
    }
  }

  const task = await db.task.create({
    data: {
      ngoId,
      assignedTo: assignedTo || null,
      title,
      description: description || null,
      priority,
      status: TaskStatus.TODO,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, "Task created successfully", task));
});

/**
 * 3. Get Task Details
 * Endpoint: GET /api/v1/tasks/:id
 */
export const getTaskDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      ngo: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!task) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
  }

  // Security: Check if user is either assigned or belongs to NGO staff
  const isAssigned = task.assignedTo === req.user?.id;
  const isNgoStaff = (req.user as any)?.ngoId === task.ngoId;
  const isAdmin = req.user?.role === "ADMIN";

  if (!isAssigned && !isNgoStaff && !isAdmin) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Access denied: You are not authorized to view this task"
    );
  }

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Task details fetched successfully", task));
});

/**
 * 4. Update Task Details
 * Endpoint: PUT /api/v1/tasks/:id
 */
export const updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, priority, dueDate, assignedTo, status } = req.body;

  const task = await db.task.findUnique({
    where: { id },
  });

  if (!task) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
  }

  // Security: Enforce NGO boundary
  const isNgoStaff = (req.user as any)?.ngoId === task.ngoId;
  const isAdmin = req.user?.role === "ADMIN";

  if (!isNgoStaff && !isAdmin) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied to update this task");
  }

  // If status is updated to DONE, set completedAt, else clean it
  let completedAtUpdate = undefined;
  if (status !== undefined) {
    completedAtUpdate = status === TaskStatus.DONE ? new Date() : null;
  }

  const updatedTask = await db.task.update({
    where: { id },
    data: {
      title: title !== undefined ? title : undefined,
      description: description !== undefined ? description : undefined,
      priority: priority !== undefined ? priority : undefined,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      assignedTo: assignedTo !== undefined ? (assignedTo ? assignedTo : null) : undefined,
      status: status !== undefined ? (status as TaskStatus) : undefined,
      completedAt: completedAtUpdate,
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Task updated successfully", updatedTask));
});

/**
 * 5. Delete Task
 * Endpoint: DELETE /api/v1/tasks/:id
 */
export const deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const task = await db.task.findUnique({
    where: { id },
  });

  if (!task) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
  }

  // Security: NGO boundary check
  const isNgoStaff = (req.user as any)?.ngoId === task.ngoId;
  const isAdmin = req.user?.role === "ADMIN";

  if (!isNgoStaff && !isAdmin) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied to delete this task");
  }

  await db.task.delete({
    where: { id },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Task deleted successfully", {}));
});

/**
 * 6. Complete Task (Quick Complete Toggle)
 * Endpoint: PATCH /api/v1/tasks/:id/complete
 */
export const completeTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const task = await db.task.findUnique({
    where: { id },
  });

  if (!task) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
  }

  // Security check: Only the assignee or NGO staff/Admin can complete
  const isAssignee = task.assignedTo === req.user?.id;
  const isNgoStaff = (req.user as any)?.ngoId === task.ngoId;
  const isAdmin = req.user?.role === "ADMIN";

  if (!isAssignee && !isNgoStaff && !isAdmin) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied to complete this task");
  }

  const updatedTask = await db.task.update({
    where: { id },
    data: {
      status: TaskStatus.DONE,
      completedAt: new Date(),
    },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Task completed successfully", updatedTask));
});

/**
 * 7. Calendar View Tasks (Tasks within date range, default to current month)
 * Endpoint: GET /api/v1/tasks/calendar
 */
export const calendarViewTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { start, end } = req.query;

  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const filter: any = {
    assignedTo: userId,
  };

  if (start && end) {
    filter.dueDate = {
      gte: new Date(start as string),
      lte: new Date(end as string),
    };
  } else {
    // Default: Return all tasks with valid due dates
    filter.dueDate = { not: null };
  }

  const tasks = await db.task.findMany({
    where: filter,
    orderBy: { dueDate: "asc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Tasks fetched for calendar successfully", tasks));
});

/**
 * 8. Today's Tasks
 * Endpoint: GET /api/v1/tasks/today
 */
export const getTodayTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const tasks = await db.task.findMany({
    where: {
      assignedTo: userId,
      dueDate: {
        gte: startOfToday,
        lte: endOfToday,
      },
    },
    orderBy: { priority: "desc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Today's tasks fetched successfully", tasks));
});

/**
 * 9. Upcoming Tasks
 * Endpoint: GET /api/v1/tasks/upcoming
 */
export const getUpcomingTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const tasks = await db.task.findMany({
    where: {
      assignedTo: userId,
      dueDate: {
        gt: endOfToday,
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, "Upcoming tasks fetched successfully", tasks));
});
