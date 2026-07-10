import { Router, Response, NextFunction } from "express";
import {
  getDashboardAnalytics,
  getDashboardWidgets,
  getDashboardStats,
  getSystemHealth,
  getDatabaseHealthStatus,
  getSecurityOverview,
  getAuditTrail,
  getRealTimeStats,
  getServerPerformanceMetrics,
  getDashboardGlobalSearch,
  getDashboardMultiFilters,
  postBulkQuickActions,
  getExportData,
  postGenerateAutomatedReport,
} from "./Dashboard.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  globalSearchSchema,
  bulkQuickActionsSchema,
  exportDataSchema,
} from "./Dashboard.validation.js";
import { Role } from "../../generated/prisma/index.js";
import { ApiError } from "../../utils/api-error.js";
import { HTTP_STATUS } from "../../utils/constants.js";

const router = Router();

// Middleware to restrict dashboard controls strictly to Platform Administrators
const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== Role.ADMIN) {
    return next(new ApiError(HTTP_STATUS.FORBIDDEN, "Access denied: Platform Admin role required"));
  }
  next();
};

// Apply auth and admin checks across all dashboard routes
router.use(authMiddleware as any, adminOnly as any);

router.get("/analytics", getDashboardAnalytics as any);
router.get("/widgets", getDashboardWidgets as any);
router.get("/stats", getDashboardStats as any);
router.get("/system-health", getSystemHealth as any);
router.get("/db-health", getDatabaseHealthStatus as any);
router.get("/security", getSecurityOverview as any);
router.get("/audit", getAuditTrail as any);
router.get("/real-time", getRealTimeStats as any);
router.get("/performance", getServerPerformanceMetrics as any);

router.get("/search", validate(globalSearchSchema), getDashboardGlobalSearch as any);
router.get("/filters", getDashboardMultiFilters as any);
router.post("/bulk-actions", validate(bulkQuickActionsSchema), postBulkQuickActions as any);
router.get("/export", validate(exportDataSchema), getExportData as any);
router.post("/report", postGenerateAutomatedReport as any);

export default router;
