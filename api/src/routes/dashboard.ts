import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

/**
 * Activity endpoints
 */

// GET /api/dashboard/activities/all - Get all activities (admin view)
router.get('/activities/all', DashboardController.getAllActivities);

// GET /api/dashboard/activities/my - Get user's activities
router.get('/activities/my', DashboardController.getMyActivities);

/**
 * Statistics endpoints
 */

// GET /api/dashboard/stats - Get dashboard overview statistics
router.get('/stats', DashboardController.getDashboardStats);

// GET /api/dashboard/stats/modules - Get activity statistics by module
router.get('/stats/modules', DashboardController.getModuleStats);

// GET /api/dashboard/stats/users - Get user activity statistics
router.get('/stats/users', DashboardController.getUserStats);

// GET /api/dashboard/timeline - Get activity timeline for charts
router.get('/timeline', DashboardController.getActivityTimeline);

export default router;