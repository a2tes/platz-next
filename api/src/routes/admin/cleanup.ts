import { Router, Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticateToken, requireAdmin } from "../../middleware/auth";
import { mediaCleanupService } from "../../services/mediaCleanupService";
import { ApiResponse } from "../../utils/apiResponse";

const router = Router();

// All routes require ADMIN role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/cleanup/stats
 * Get cleanup statistics
 */
router.get(
	"/stats",
	asyncHandler(async (req: Request, res: Response) => {
		const stats = await mediaCleanupService.getStats();
		ApiResponse.success(res, stats);
	})
);

/**
 * GET /api/admin/cleanup/preview
 * Preview which files would be deleted (dry-run)
 */
router.get(
	"/preview",
	asyncHandler(async (req: Request, res: Response) => {
		const batchSize = parseInt(req.query.batchSize as string) || 100;
		const retentionDays = parseInt(req.query.retentionDays as string) || undefined;

		const result = await mediaCleanupService.runCleanup({
			dryRun: true,
			batchSize,
			retentionDays,
		});

		ApiResponse.success(res, {
			message: "Dry run complete - no files were actually deleted",
			...result,
		});
	})
);

/**
 * POST /api/admin/cleanup/run
 * Execute cleanup (actually delete files)
 */
router.post(
	"/run",
	asyncHandler(async (req: Request, res: Response) => {
		const body = req.body || {};
		const batchSize = body.batchSize ?? 100;
		const retentionDays = body.retentionDays;
		const dryRun = body.dryRun ?? false;

		const result = await mediaCleanupService.runCleanup({
			dryRun,
			batchSize,
			retentionDays,
		});

		ApiResponse.success(res, {
			message: dryRun ? "Dry run complete" : "Cleanup complete",
			...result,
		});
	})
);

/**
 * GET /api/admin/cleanup/eligible
 * List files eligible for cleanup
 */
router.get(
	"/eligible",
	asyncHandler(async (req: Request, res: Response) => {
		const batchSize = parseInt(req.query.batchSize as string) || 100;
		const retentionDays = parseInt(req.query.retentionDays as string) || undefined;

		const files = await mediaCleanupService.findEligibleFiles({
			batchSize,
			retentionDays,
		});

		ApiResponse.success(res, {
			count: files.length,
			files,
		});
	})
);

export default router;
