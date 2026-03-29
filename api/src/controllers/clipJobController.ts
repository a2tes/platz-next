/**
 * Clip Jobs Controller
 * API endpoints for managing video clip processing jobs
 */

import { Request, Response, NextFunction } from "express";
import { clipJobService } from "../services/clipJobService";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";

/**
 * Enrich a clip job record with full CDN URLs
 */
function enrichClipWithUrls(clip: any) {
	if (!clip) return clip;
	const domain = VIDEO_PROCESSING_CONFIG.cloudfront?.domain;
	if (!domain) return clip;

	return {
		...clip,
		outputUrl: clip.outputPath ? `https://${domain}/${clip.outputPath}` : null,
		thumbnailUrl: clip.thumbnailPath ? `https://${domain}/${clip.thumbnailPath}` : null,
	};
}

/**
 * Get clip job by ID
 * GET /api/clip-jobs/:id
 */
export async function getClipJob(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;

		const job = await clipJobService.getJob(id as string);

		if (!job) {
			return res.status(404).json({ error: "Clip job not found" });
		}

		res.json({ data: job });
	} catch (error) {
		next(error);
	}
}

/**
 * Get clip jobs for a context
 * GET /api/clip-jobs?contextType=block&contextId=1
 */
export async function getClipJobs(req: Request, res: Response, next: NextFunction) {
	try {
		const { contextType, contextId } = req.query;

		if (!contextType || !contextId) {
			return res.status(400).json({ error: "contextType and contextId are required" });
		}

		const jobs = await clipJobService.getJobsForContext(contextType as string, parseInt(contextId as string));

		res.json({ data: jobs });
	} catch (error) {
		next(error);
	}
}

/**
 * Get all clip jobs with pagination
 * GET /api/clip-jobs/all?page=1&limit=20&status=COMPLETED&search=video
 */
export async function getAllClipJobs(req: Request, res: Response, next: NextFunction) {
	try {
		const page = req.query.page ? parseInt(req.query.page as string) : 1;
		const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
		const status = req.query.status as string | undefined;
		const search = req.query.search as string | undefined;

		const result = await clipJobService.getAllClips({
			page,
			limit,
			status: status as any,
			search,
		});

		res.json({ data: result.clips.map(enrichClipWithUrls), meta: { pagination: result.pagination } });
	} catch (error) {
		next(error);
	}
}

/**
 * Get pending clip jobs (for admin/debugging)
 * GET /api/clip-jobs/pending
 */
export async function getPendingClipJobs(req: Request, res: Response, next: NextFunction) {
	try {
		const { limit } = req.query;

		const jobs = await clipJobService.getPendingJobs(limit ? parseInt(limit as string) : 10);

		res.json({ data: jobs });
	} catch (error) {
		next(error);
	}
}

/**
 * Get completed clips for a source media file
 * GET /api/clip-jobs/by-media/:mediaId
 */
export async function getClipsByMedia(req: Request, res: Response, next: NextFunction) {
	try {
		const mediaId = parseInt(req.params.mediaId as string);
		if (isNaN(mediaId)) {
			return res.status(400).json({ error: "Invalid media ID" });
		}

		const clips = await clipJobService.findClipsForMedia(mediaId);

		res.json({ data: clips.map(enrichClipWithUrls) });
	} catch (error) {
		next(error);
	}
}

/**
 * Get clip usage information
 * GET /api/clip-jobs/:id/usage
 */
export async function getClipUsage(req: Request, res: Response, next: NextFunction) {
	try {
		const id = req.params.id as string;
		const usage = await clipJobService.getClipUsage(id);
		res.json({ data: usage });
	} catch (error) {
		next(error);
	}
}

/**
 * Delete a clip job (only if not in use)
 * DELETE /api/clip-jobs/:id
 */
export async function deleteClipJob(req: Request, res: Response, next: NextFunction) {
	try {
		const id = req.params.id as string;
		await clipJobService.deleteClip(id);
		res.json({ data: { message: "Clip deleted successfully" } });
	} catch (error: any) {
		if (error?.message?.includes("in use")) {
			return res.status(409).json({ error: error.message });
		}
		next(error);
	}
}

/**
 * Retry a failed clip job
 * POST /api/clip-jobs/:id/retry
 */
export async function retryClipJob(req: Request, res: Response, next: NextFunction) {
	try {
		const id = req.params.id as string;
		const clip = await clipJobService.retryClip(id);
		res.json({ data: enrichClipWithUrls(clip) });
	} catch (error: any) {
		if (error?.message?.includes("only retry")) {
			return res.status(400).json({ error: error.message });
		}
		next(error);
	}
}
