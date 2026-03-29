import { Request, Response, NextFunction } from "express";
import { starringsService } from "../services/starringsService";
import { ActivityService } from "../services/activityService";
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
const createStarringSchema = z.object({
	title: z.string().min(1).max(191),
	slug: z.string().optional(),
	shortDescription: z.string().optional(),
	biography: z.string().optional(),
	avatarId: z.number().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

const updateStarringSchema = createStarringSchema.partial();

const getStarringsSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	sortBy: z.enum(["title", "createdAt", "updatedAt"]).default("title"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
	mine: z.boolean().optional(),
	trash: z.boolean().optional(),
});

export class StarringsController {
	/**
	 * Create a new starring
	 */
	async createStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const data = createStarringSchema.parse(req.body);

			const starring = await starringsService.createStarring(data, {
				currentUserId: req.user?.id,
			});

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "works",
				itemType: "starring",
				itemId: starring.id,
				itemTitle: starring.title,
				description: `The starring **${starring.title}** has been created`,
			});

			res.status(201).json(apiResponse.success(starring));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get all starrings with pagination and filtering
	 */
	async getStarrings(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const query = getStarringsSchema.parse({
				page: req.query.page ? parseInt(req.query.page as string) : undefined,
				limit: req.query.limit
					? parseInt(req.query.limit as string)
					: undefined,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
				status: req.query.status as string,
				mine: req.query.mine === "true",
				trash: req.query.trash === "true",
			});

			const result = await starringsService.getStarrings(query, {
				currentUserId: req.user?.id,
			});

			res.json(
				apiResponse.success(result.starrings, { pagination: result.pagination })
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get starring by ID
	 */
	async getStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const starringId = parseInt(req.params.id as string);
			if (isNaN(starringId)) {
				res
					.status(400)
					.json(apiResponse.error("Invalid starring ID", "INVALID_ID"));
				return;
			}

			// Allow fetching trashed starrings so users can still edit/restore them
			const starring = await starringsService.getStarringById(starringId, {
				includeTrashed: true,
			});
			if (!starring) {
				res
					.status(404)
					.json(apiResponse.error("Starring not found", "STARRING_NOT_FOUND"));
				return;
			}

			res.json(apiResponse.success(starring));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Update starring
	 */
	async updateStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const starringId = parseInt(req.params.id as string);
			if (isNaN(starringId)) {
				res
					.status(400)
					.json(apiResponse.error("Invalid starring ID", "INVALID_ID"));
				return;
			}

			const data = updateStarringSchema.parse(req.body);

			const starring = await starringsService.updateStarring(starringId, data);
			if (!starring) {
				res
					.status(404)
					.json(apiResponse.error("Starring not found", "STARRING_NOT_FOUND"));
				return;
			}

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "works",
				itemType: "starring",
				itemId: starring.id,
				itemTitle: starring.title,
				description: `The starring **${starring.title}** has been updated`,
			});

			res.json(apiResponse.success(starring));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete starring (move to Trash)
	 */
	async deleteStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const starringId = parseInt(req.params.id as string);
			if (isNaN(starringId)) {
				res
					.status(400)
					.json(apiResponse.error("Invalid starring ID", "INVALID_ID"));
				return;
			}

			// Get starring info before deletion for logging
			const starring = await starringsService.getStarringById(starringId);
			if (!starring) {
				res
					.status(404)
					.json(apiResponse.error("Starring not found", "STARRING_NOT_FOUND"));
				return;
			}

			await starringsService.deleteStarring(starringId);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "works",
				itemType: "starring",
				itemId: starringId,
				itemTitle: starring.title,
				description: `The starring **${starring.title}** has been deleted`,
			});

			res.json(apiResponse.success({ message: "Starring moved to Trash" }));
		} catch (error) {
			next(error);
		}
	}

	/** Move to trash */
	async trashStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const starring = await starringsService.getStarringById(id);
			await starringsService.trashStarring(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "works",
				itemType: "starring",
				itemId: id,
				itemTitle: starring?.title,
				description: `The starring **${starring?.title}** has been deleted`,
			});
			res.json(apiResponse.success({ message: "Moved to Trash" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Bulk delete starrings (move to Trash)
	 */
	async bulkDeleteStarrings(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const schema = z.object({ ids: z.array(z.number()).min(1) });
			const { ids } = schema.parse(req.body);

			const result = await starringsService.bulkDeleteStarrings(ids);

			if (result.deleted?.length) {
				await ActivityService.logMany(
					result.deleted.map((item) => ({
						userId: req.user!.id,
						action: "delete",
						module: "works",
						itemType: "starring",
						itemId: item.id,
						itemTitle: item.title,
						description: `The starring **${item.title}** has been deleted`,
					}))
				);
			}

			res.json(
				apiResponse.success({
					deletedIds: result.deleted?.map((d) => d.id) || [],
					skipped: result.skipped,
				})
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Bulk purge starrings
	 */
	async bulkPurgeStarrings(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const schema = z.object({ ids: z.array(z.number()).min(1) });
			const { ids } = schema.parse(req.body);

			const result = await starringsService.bulkPurgeStarrings(ids);

			if (result.purged?.length) {
				await ActivityService.logMany(
					result.purged.map((item) => ({
						userId: req.user!.id,
						action: "delete",
						module: "works",
						itemType: "starring",
						itemId: item.id,
						itemTitle: item.title,
						description: `The starring **${item.title}** has been permanently deleted`,
					}))
				);
			}

			res.json(
				apiResponse.success({
					purgedIds: result.purged?.map((p) => p.id) || [],
					skipped: result.skipped,
				})
			);
		} catch (error) {
			next(error);
		}
	}

	/** Restore from trash */
	async restoreStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const starring = await starringsService.getStarringById(id, {
				includeTrashed: true,
			});
			await starringsService.restoreStarring(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "works",
				itemType: "starring",
				itemId: id,
				itemTitle: starring?.title,
				description: `The starring **${starring?.title}** has been restored`,
			});
			res.json(apiResponse.success({ message: "Restored from Trash" }));
		} catch (error) {
			next(error);
		}
	}

	/** Purge (hide permanently) */
	async purgeStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const starring = await starringsService.getStarringById(id, {
				includeTrashed: true,
				includePurged: true,
			});
			await starringsService.purgeStarring(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "works",
				itemType: "starring",
				itemId: id,
				itemTitle: starring?.title,
				description: `The starring **${starring?.title}** has been permanently deleted`,
			});
			res.json(
				apiResponse.success({ message: "Starring permanently deleted" })
			);
		} catch (error) {
			next(error);
		}
	}

	/** Get filter counts */
	async getCounts(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const counts = await starringsService.getFilterCounts(req.user?.id);
			res.json(apiResponse.success(counts));
		} catch (error) {
			next(error);
		}
	}

	/** Publish starring */
	async publishStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const starring = await starringsService.getStarringById(id);
			await starringsService.publishStarring(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "publish",
				module: "works",
				itemType: "starring",
				itemId: id,
				itemTitle: starring?.title,
				description: `The starring **${starring?.title}** has been published`,
			});
			res.json(apiResponse.success({ message: "Published" }));
		} catch (error) {
			next(error);
		}
	}

	/** Unpublish starring */
	async unpublishStarring(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const id = parseInt(req.params.id as string);
			const starring = await starringsService.getStarringById(id);
			await starringsService.unpublishStarring(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "unpublish",
				module: "works",
				itemType: "starring",
				itemId: id,
				itemTitle: starring?.title,
				description: `The starring **${starring?.title}** has been unpublished`,
			});
			res.json(apiResponse.success({ message: "Unpublished" }));
		} catch (error) {
			next(error);
		}
	}

	/** Get all trashed starrings */
	async getTrashedStarrings(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		try {
			const query = getStarringsSchema.parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
			});

			const result = await starringsService.getTrashedStarrings(query);

			res.json(
				apiResponse.success(result.starrings, { pagination: result.pagination })
			);
		} catch (error) {
			next(error);
		}
	}
}

export const starringsController = new StarringsController();
