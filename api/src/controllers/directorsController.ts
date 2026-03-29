import { Request, Response, NextFunction } from "express";
import { directorsService } from "../services/directorsService";
import { ActivityService } from "../services/activityService";
import { prisma } from "../config/database";
import { clipProcessingService, ClipProcessingStatus } from "../services/clipProcessingService";
import { z } from "zod";

// Helper function for API responses
const apiResponse = {
	success: (data: any, meta?: any) => ({
		success: true,
		data,
		meta: { timestamp: new Date().toISOString(), ...meta },
	}),
	error: (message: string, code: string) => ({
		success: false,
		error: {
			code,
			message,
			timestamp: new Date().toISOString(),
		},
	}),
};

// Validation schemas
const createDirectorSchema = z.object({
	title: z.string().min(1).max(191),
	slug: z.string().optional(),
	shortDescription: z.string().optional(),
	biography: z.string().optional(),
	links: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
	avatarId: z.number().optional(),
	ogImageId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "UNLISTED"]).optional(),
});

const updateDirectorSchema = createDirectorSchema.partial();

const getDirectorsSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(1000).default(20),
	search: z.string().optional(),
	sortBy: z.enum(["title", "createdAt", "updatedAt"]).default("title"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	status: z.enum(["DRAFT", "PUBLISHED", "UNLISTED", "ALL"]).default("ALL"),
	mine: z.boolean().optional(),
});

export class DirectorsController {
	/**
	 * Create a new director
	 */
	async createDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = createDirectorSchema.parse(req.body);

			const director = await directorsService.createDirector(data, {
				currentUserId: req.user?.id,
			});

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "works",
				itemType: "director",
				itemId: director.id,
				itemTitle: director.title,
				description: `The director **${director.title}** has been created`,
			});

			res.status(201).json(apiResponse.success(director));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get all directors with pagination and filtering
	 */
	async getDirectors(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getDirectorsSchema.parse({
				page: req.query.page ? parseInt(req.query.page as string) : undefined,
				limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
				status: req.query.status as string,
				mine: req.query.mine ? req.query.mine === "true" : undefined,
			});

			const result = await directorsService.getDirectors(query, {
				currentUserId: req.user?.id,
			});

			res.json(apiResponse.success(result.directors, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/** Get filter counts */
	async getCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const counts = await directorsService.getFilterCounts(req.user?.id);
			res.json(apiResponse.success(counts));
		} catch (error) {
			next(error);
		}
	}

	/** Publish director */
	async publishDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const director = await directorsService.getDirectorById(id);
			await directorsService.publishDirector(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "works",
				itemType: "director",
				itemId: id,
				itemTitle: director?.title,
				description: `The director **${director?.title}** has been published`,
			});
			res.json(apiResponse.success({ message: "Published" }));
		} catch (error) {
			next(error);
		}
	}

	/** Unpublish director */
	async unpublishDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const director = await directorsService.getDirectorById(id);
			await directorsService.unpublishDirector(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "works",
				itemType: "director",
				itemId: id,
				itemTitle: director?.title,
				description: `The director **${director?.title}** has been unpublished`,
			});
			res.json(apiResponse.success({ message: "Unpublished" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get director by ID
	 */
	async getDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}

			// Allow fetching trashed directors so users can still edit/restore them
			const director = await directorsService.getDirectorById(directorId, {
				includeTrashed: true,
			});
			if (!director) {
				res.status(404).json(apiResponse.error("Director not found", "DIRECTOR_NOT_FOUND"));
				return;
			}

			res.json(apiResponse.success(director));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Update director
	 */
	async updateDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}

			const data = updateDirectorSchema.parse(req.body);

			const director = await directorsService.updateDirector(directorId, data);
			if (!director) {
				res.status(404).json(apiResponse.error("Director not found", "DIRECTOR_NOT_FOUND"));
				return;
			}

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "works",
				itemType: "director",
				itemId: director.id,
				itemTitle: director.title,
				description: `The director **${director.title}** has been updated`,
			});

			res.json(apiResponse.success(director));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete director (move to Trash)
	 */
	async deleteDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}

			// Get director info before deletion for logging
			const director = await directorsService.getDirectorById(directorId);
			if (!director) {
				res.status(404).json(apiResponse.error("Director not found", "DIRECTOR_NOT_FOUND"));
				return;
			}

			await directorsService.deleteDirector(directorId);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "works",
				itemType: "director",
				itemId: directorId,
				itemTitle: director.title,
				description: `The director **${director.title}** has been deleted`,
			});

			res.json(apiResponse.success({ message: "Director moved to Trash" }));
		} catch (error) {
			next(error);
		}
	}

	/** Move to trash */
	async trashDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const director = await directorsService.getDirectorById(id);
			await directorsService.trashDirector(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "works",
				itemType: "director",
				itemId: id,
				itemTitle: director?.title,
				description: `The director **${director?.title}** has been deleted`,
			});
			res.json(apiResponse.success({ message: "Moved to Trash" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Bulk delete directors (move to Trash)
	 */
	async bulkDeleteDirectors(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({ ids: z.array(z.number()).min(1) });
			const { ids } = schema.parse(req.body);

			const result = await directorsService.bulkDeleteDirectors(ids);

			for (const director of result.deletedDirectors) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "works",
					itemType: "director",
					itemId: director.id,
					itemTitle: director.title,
					description: `The director **${director.title}** has been deleted`,
				});
			}

			res.json(
				apiResponse.success({
					deletedIds: result.deletedIds,
					skipped: result.skipped,
				}),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Bulk purge directors
	 */
	async bulkPurgeDirectors(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({ ids: z.array(z.number()).min(1) });
			const { ids } = schema.parse(req.body);

			const result = await directorsService.bulkPurgeDirectors(ids);

			for (const director of result.purgedDirectors) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "permanentlyDelete",
					module: "works",
					itemType: "director",
					itemId: director.id,
					itemTitle: director.title,
					description: `The director **${director.title}** has been permanently deleted`,
				});
			}

			res.json(
				apiResponse.success({
					purgedIds: result.purgedIds,
					skipped: result.skipped,
				}),
			);
		} catch (error) {
			next(error);
		}
	}

	/** Restore from trash */
	async restoreDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			await directorsService.restoreDirector(id);
			const director = await directorsService.getDirectorById(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "restore",
				module: "works",
				itemType: "director",
				itemId: id,
				itemTitle: director?.title,
				description: `**${director?.title}** director has been restored`,
			});
			res.json(apiResponse.success({ message: "Restored from Trash" }));
		} catch (error) {
			next(error);
		}
	}

	/** Purge (hide permanently) */
	async purgeDirector(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const director = await directorsService.getDirectorById(id, {
				includeTrashed: true,
			});
			await directorsService.purgeDirector(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "permanentlyDelete",
				module: "works",
				itemType: "director",
				itemId: id,
				itemTitle: director?.title,
				description: `**${director?.title}** director has been permanently deleted`,
			});
			res.json(apiResponse.success({ message: "Director permanently deleted" }));
		} catch (error) {
			next(error);
		}
	}

	/** Get all trashed directors */
	async getTrashedDirectors(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getDirectorsSchema.parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
			});

			const result = await directorsService.getTrashedDirectors(query);

			res.json(apiResponse.success(result.directors, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/** List works for a director (ordered) */
	async getDirectorWorks(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}
			const works = await directorsService.getDirectorWorks(directorId);
			res.json(apiResponse.success(works));
		} catch (error) {
			next(error);
		}
	}

	/** Reorder works for a director */
	async reorderDirectorWorks(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}
			const schema = z.object({ workIds: z.array(z.number()).min(1) });
			const { workIds } = schema.parse(req.body);
			const result = await directorsService.reorderDirectorWorks(directorId, workIds);
			// Activity log (generic reorder)
			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/** Get paginated works for a director (for block editor content selector) */
	async getDirectorWorksPaginated(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}
			const page = Math.max(1, parseInt(req.query.page as string) || 1);
			const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
			const search = (req.query.search as string) || "";

			const result = await directorsService.getDirectorWorksPaginated(directorId, { page, limit, search });
			res.json(apiResponse.success(result.works, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/** Set or update hero video for a director */
	async setHeroVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}

			const schema = z.object({
				heroWorkId: z.number(),
				cropSettings: z
					.object({
						x: z.number(),
						y: z.number(),
						width: z.number(),
						height: z.number(),
						aspect: z.number(),
					})
					.optional(),
				trimSettings: z
					.object({
						startTime: z.number(),
						endTime: z.number(),
					})
					.optional(),
			});
			const data = schema.parse(req.body);

			const director = await directorsService.getDirectorById(directorId);
			if (!director) {
				res.status(404).json(apiResponse.error("Director not found", "DIRECTOR_NOT_FOUND"));
				return;
			}

			// Look up the work to get its videoFileId
			const work = await prisma.work.findUnique({
				where: { id: data.heroWorkId },
				select: { id: true, videoFileId: true },
			});
			if (!work) {
				res.status(404).json(apiResponse.error("Work not found", "WORK_NOT_FOUND"));
				return;
			}

			const heroVideo: any = {
				cropSettings: data.cropSettings || null,
				trimSettings: data.trimSettings || null,
				processedVideo: null,
			};

			await prisma.director.update({
				where: { id: directorId },
				data: {
					heroWorkId: data.heroWorkId,
					heroMediaId: work.videoFileId,
					heroVideo,
				},
			});

			res.json(apiResponse.success({ message: "Hero video updated" }));
		} catch (error) {
			next(error);
		}
	}

	/** Process hero video clip for a director */
	async processHeroVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}

			const schema = z.object({
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
			const settings = schema.parse(req.body);

			const director = await prisma.director.findUnique({
				where: { id: directorId },
				select: { id: true, heroMediaId: true, heroVideo: true },
			});
			if (!director || !director.heroMediaId) {
				res.status(400).json(apiResponse.error("Director has no hero media set", "NO_HERO_MEDIA"));
				return;
			}

			if (!settings.cropSettings && !settings.trimSettings) {
				res.status(400).json(apiResponse.error("At least cropSettings or trimSettings required", "INVALID_SETTINGS"));
				return;
			}

			const jobResult = await clipProcessingService.createClipJob({
				contextType: "director_hero",
				contextId: directorId,
				mediaFileId: director.heroMediaId,
				cropSettings: settings.cropSettings,
				trimSettings: settings.trimSettings,
				mode: "clip",
			});

			if (!jobResult) {
				res.status(500).json(apiResponse.error("Failed to create processing job", "PROCESSING_ERROR"));
				return;
			}

			// Update director heroVideo with pending status
			const heroVideo: any = {
				...((director.heroVideo as any) || {}),
				cropSettings: settings.cropSettings || null,
				trimSettings: settings.trimSettings || null,
				processedVideo: {
					status: ClipProcessingStatus.PENDING,
					settingsHash: jobResult.settingsHash,
					clipJobId: jobResult.clipJobId,
				},
			};

			await prisma.director.update({
				where: { id: directorId },
				data: { heroVideo },
			});

			res.json(
				apiResponse.success({
					jobId: jobResult.clipJobId,
					settingsHash: jobResult.settingsHash,
					status: ClipProcessingStatus.PENDING,
				}),
			);
		} catch (error) {
			next(error);
		}
	}

	/** Remove hero video from a director */
	async removeHeroVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const directorId = parseInt(req.params.id as string);
			if (isNaN(directorId)) {
				res.status(400).json(apiResponse.error("Invalid director ID", "INVALID_ID"));
				return;
			}

			await prisma.director.update({
				where: { id: directorId },
				data: {
					heroWorkId: null,
					heroMediaId: null,
					heroVideo: null as any,
				},
			});

			res.json(apiResponse.success({ message: "Hero video removed" }));
		} catch (error) {
			next(error);
		}
	}
}

export const directorsController = new DirectorsController();
