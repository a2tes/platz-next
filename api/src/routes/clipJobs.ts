/**
 * Clip Jobs Routes
 * API endpoints for video clip processing jobs
 */

import { Router } from "express";
import {
	getClipJob,
	getClipJobs,
	getAllClipJobs,
	getPendingClipJobs,
	getClipsByMedia,
	getClipUsage,
	deleteClipJob,
	retryClipJob,
} from "../controllers/clipJobController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get all clips with pagination (admin media library)
router.get("/all", getAllClipJobs);

// Get pending jobs (admin/debugging)
router.get("/pending", getPendingClipJobs);

// Get completed clips for a source media file
router.get("/by-media/:mediaId", getClipsByMedia);

// Get jobs for a context
router.get("/", getClipJobs);

// Get clip usage info
router.get("/:id/usage", getClipUsage);

// Retry a failed clip job
router.post("/:id/retry", retryClipJob);

// Get single job by ID
router.get("/:id", getClipJob);

// Delete a clip job (only if not in use)
router.delete("/:id", deleteClipJob);

export default router;
