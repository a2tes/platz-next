import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { homepageService } from "../services/homepageService";
import { ActivityService } from "../services/activityService";
import { clipProcessingService, ClipProcessingStatus } from "../services/clipProcessingService";
import { prisma } from "../config/database";
import { serializeMediaFile } from "../utils/serialization";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";

const apiResponse = {
	success: (data: any, meta?: any) => ({
		success: true,
		data,
		meta: { timestamp: new Date().toISOString(), ...meta },
	}),
	error: (message: string, code: string) => ({
		success: false,
		error: { code, message, timestamp: new Date().toISOString() },
	}),
};

const addSelectionSchema = z.object({
	directorId: z.number().min(1),
	workId: z.number().min(1),
});

const reorderSchema = z.object({
	itemIds: z.array(z.number()).min(1),
});

const videoSourceSchema = z.object({
	videoSource: z.enum(["original", "default_clip", "clip"]),
	clipJobId: z.string().optional(),
});

const processClipSchema = z.object({
	cropSettings: z
		.object({
			x: z.number(),
			y: z.number(),
			width: z.number(),
			height: z.number(),
			aspect: z.number(),
			aspectLabel: z.string().optional(),
		})
		.optional(),
	trimSettings: z
		.object({
			startTime: z.number(),
			endTime: z.number(),
		})
		.optional(),
});

export class HomepageController {
	private serializeRow(row: any) {
		const result = { ...row };

		if (result?.work?.videoFile) {
			result.work = { ...result.work, videoFile: serializeMediaFile(result.work.videoFile) };
		}

		if (result?.clipJob) {
			const domain = VIDEO_PROCESSING_CONFIG.cloudfront?.domain;
			if (domain) {
				result.clipJob = {
					...result.clipJob,
					outputUrl: result.clipJob.outputPath ? `https://${domain}/${result.clipJob.outputPath}` : null,
					thumbnailUrl: result.clipJob.thumbnailPath ? `https://${domain}/${result.clipJob.thumbnailPath}` : null,
				};
			}
		}

		return result;
	}

	async getSelections(req: Request, res: Response, next: NextFunction) {
		try {
			const rows = await homepageService.getSelections();
			res.json(apiResponse.success(rows.map((r) => this.serializeRow(r))));
		} catch (err) {
			next(err);
		}
	}

	async addSelection(req: Request, res: Response, next: NextFunction) {
		try {
			const { directorId, workId } = addSelectionSchema.parse(req.body);
			const result = await homepageService.addSelection(directorId, workId);

			await ActivityService.log({
				userId: req.user!.id,
				action: "publish",
				module: "homepage",
				itemType: "homepageDirector",
				itemId: result.id,
				itemTitle: result.work?.title || "Work",
				description: `Work added to homepage`,
			});

			res.json(apiResponse.success(this.serializeRow(result)));
		} catch (err) {
			next(err);
		}
	}

	async removeSelection(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			if (isNaN(id)) {
				return res.status(400).json(apiResponse.error("Invalid selection ID", "INVALID_ID"));
			}

			const result = await homepageService.removeSelection(id);

			await ActivityService.log({
				userId: req.user!.id,
				action: "unpublish",
				module: "homepage",
				itemType: "homepageDirector",
				itemId: id,
				itemTitle: "Work",
				description: `Work removed from homepage`,
			});

			res.json(apiResponse.success(result));
		} catch (err) {
			next(err);
		}
	}

	async reorder(req: Request, res: Response, next: NextFunction) {
		try {
			const { itemIds } = reorderSchema.parse(req.body);
			const result = await homepageService.reorderItems(itemIds);
			res.json(apiResponse.success(result));
		} catch (err) {
			next(err);
		}
	}

	async updateVideoSource(req: Request, res: Response, next: NextFunction) {
		try {
			const selectionId = parseInt(req.params.id as string);
			if (isNaN(selectionId)) {
				return res.status(400).json(apiResponse.error("Invalid selection ID", "INVALID_ID"));
			}
			const { videoSource, clipJobId } = videoSourceSchema.parse(req.body);

			if (videoSource === "clip" && !clipJobId) {
				return res
					.status(400)
					.json(apiResponse.error("clipJobId is required when videoSource is 'clip'", "MISSING_CLIP_JOB"));
			}

			const result = await homepageService.updateVideoSource(selectionId, videoSource, clipJobId);
			res.json(apiResponse.success(this.serializeRow(result)));
		} catch (err) {
			next(err);
		}
	}

	async processClip(req: Request, res: Response, next: NextFunction) {
		try {
			const selectionId = parseInt(req.params.id as string);
			if (isNaN(selectionId)) {
				res.status(400).json(apiResponse.error("Invalid selection ID", "INVALID_ID"));
				return;
			}

			const settings = processClipSchema.parse(req.body);

			if (!settings.cropSettings && !settings.trimSettings) {
				res.status(400).json(apiResponse.error("At least cropSettings or trimSettings required", "INVALID_SETTINGS"));
				return;
			}

			const selection = await homepageService.getSelection(selectionId);
			const videoFileId = selection.work?.videoFileId;
			if (!videoFileId) {
				res.status(400).json(apiResponse.error("Selected work has no video file", "NO_VIDEO"));
				return;
			}

			const jobResult = await clipProcessingService.createClipJob({
				contextType: "homepage",
				contextId: selectionId,
				mediaFileId: videoFileId,
				cropSettings: settings.cropSettings,
				trimSettings: settings.trimSettings,
				mode: "clip",
			});

			if (!jobResult) {
				res.status(503).json(apiResponse.error("Video processing service is not configured", "PROCESSING_UNAVAILABLE"));
				return;
			}

			// Update selection with clip job reference
			await homepageService.updateVideoSource(selectionId, "clip", jobResult.clipJobId);

			res.json(
				apiResponse.success({
					jobId: jobResult.clipJobId,
					settingsHash: jobResult.settingsHash,
					status: "pending",
				}),
			);
		} catch (err) {
			next(err);
		}
	}
}

export const homepageController = new HomepageController();
