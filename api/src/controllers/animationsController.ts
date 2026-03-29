import { Request, Response } from "express";
import { animationsService } from "../services/animationsService";
import { ActivityService } from "../services/activityService";
import { z } from "zod";
import { serializeAnimation } from "../utils/serialization";

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
const createAnimationSchema = z.object({
	title: z.string().min(1).max(191),
	shortDescription: z.string().optional(),
	client: z.string().max(191).optional(),
	tags: z.array(z.string()).default([]),
	videoFileId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

const updateAnimationSchema = createAnimationSchema.partial();

const getAnimationsSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "ALL"]).default("ALL"),
	sortBy: z.enum(["title", "client", "createdAt", "updatedAt", "sortOrder"]).default("sortOrder"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const reorderAnimationsSchema = z.object({
	animationIds: z.array(z.number()).min(1),
});

export class AnimationsController {
	async getAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		// Allow fetching trashed animations so users can still edit/restore them
		const animation = await animationsService.getAnimationById(animationId, {
			includeTrashed: true,
		});
		if (!animation) {
			res.status(404).json(apiResponse.error("Animation not found", "ANIMATION_NOT_FOUND"));
			return;
		}

		res.json(apiResponse.success(serializeAnimation(animation)));
	}

	async getAnimations(req: Request, res: Response) {
		const query = getAnimationsSchema.extend({ mine: z.coerce.boolean().optional() }).parse({
			page: req.query.page ? parseInt(req.query.page as string) : undefined,
			limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
			search: req.query.search as string,
			status: req.query.status as string,
			sortBy: req.query.sortBy as string,
			sortOrder: req.query.sortOrder as string,
			mine: req.query.mine as any,
		});

		const result = await animationsService.getAnimations(query, {
			currentUserId: req.user?.id,
		});

		res.json(
			apiResponse.success(result.animations.map(serializeAnimation), {
				pagination: result.pagination,
			}),
		);
	}

	async getCounts(req: Request, res: Response) {
		const counts = await animationsService.getFilterCounts(req.user!.id);
		res.json(apiResponse.success(counts));
	}

	async getTrashedAnimations(req: Request, res: Response) {
		const query = getAnimationsSchema
			.omit({ status: true })
			.extend({ status: z.enum(["DRAFT", "PUBLISHED", "ALL"]).optional() })
			.parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
			});

		const result = await animationsService.getTrashedAnimations(query);
		res.json(
			apiResponse.success(result.animations.map(serializeAnimation), {
				pagination: result.pagination,
			}),
		);
	}

	async createAnimation(req: Request, res: Response) {
		const data = createAnimationSchema.parse(req.body);

		const animation = await animationsService.createAnimation(data, req.user!.id);

		ActivityService.log({
			userId: req.user!.id,
			action: "create",
			module: "animations",
			itemType: "animation",
			itemId: animation.id,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been created`,
			metadata: data,
		});

		res.status(201).json(apiResponse.success(serializeAnimation(animation)));
	}

	async updateAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		const data = updateAnimationSchema.parse(req.body);

		const animation = await animationsService.updateAnimation(animationId, data, req.user!.id);
		if (!animation) {
			res.status(404).json(apiResponse.error("Animation not found", "ANIMATION_NOT_FOUND"));
			return;
		}
		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "animations",
			itemType: "animation",
			itemId: animation.id,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been updated`,
			metadata: data,
		});

		res.json(apiResponse.success(serializeAnimation(animation)));
	}

	async updateAnimationTitle(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		const { title } = req.body;
		if (!title || typeof title !== "string") {
			res.status(400).json(apiResponse.error("Title is required", "INVALID_TITLE"));
			return;
		}

		const animation = await animationsService.updateAnimationTitle(animationId, title, req.user?.id);
		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "animations",
			itemType: "animation",
			itemId: animationId,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been updated`,
		});

		res.json(apiResponse.success(serializeAnimation(animation)));
	}

	async deleteAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		// Get animation info before deletion for logging
		const animation = await animationsService.getAnimationById(animationId);
		if (!animation) {
			res.status(404).json(apiResponse.error("Animation not found", "ANIMATION_NOT_FOUND"));
			return;
		}

		await animationsService.deleteAnimation(animationId);

		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "animations",
			itemType: "animation",
			itemId: animationId,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been deleted`,
		});

		res.json(apiResponse.success({ message: "Animation moved to Trash" }));
	}

	async trashAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		const animation = await animationsService.trashAnimation(animationId);
		const animationTitle = (animation as any).title ?? `Animation ${animationId}`;
		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "animations",
			itemType: "animation",
			itemId: animationId,
			itemTitle: animationTitle,
			description: `**${animationTitle}** animation has been deleted`,
		});
		res.json(apiResponse.success({ message: "Moved to Trash" }));
	}

	async restoreAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		await animationsService.restoreAnimation(animationId);
		const animation = await animationsService.getAnimationById(animationId);
		ActivityService.log({
			userId: req.user!.id,
			action: "restore",
			module: "animations",
			itemType: "animation",
			itemId: animationId,
			itemTitle: animation?.title,
			description: `**${animation?.title}** has been restored`,
		});
		res.json(apiResponse.success({ message: "Restored from Trash" }));
	}

	async purgeAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		const animation = await animationsService.getAnimationById(animationId, {
			includeTrashed: true,
		});
		await animationsService.purgeAnimation(animationId);
		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "animations",
			itemType: "animation",
			itemId: animationId,
			itemTitle: animation?.title,
			description: `**${animation?.title}** has been permanently deleted`,
		});
		res.json(apiResponse.success({ message: "Purged successfully" }));
	}

	async publishAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		const animation = await animationsService.publishAnimation(animationId);
		if (!animation) {
			res.status(404).json(apiResponse.error("Animation not found", "ANIMATION_NOT_FOUND"));
			return;
		}

		ActivityService.log({
			userId: req.user!.id,
			action: "publish",
			module: "animations",
			itemType: "animation",
			itemId: animation.id,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been published`,
		});

		res.json(apiResponse.success(animation));
	}

	async unpublishAnimation(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		if (isNaN(animationId)) {
			res.status(400).json(apiResponse.error("Invalid animation ID", "INVALID_ID"));
			return;
		}

		const animation = await animationsService.unpublishAnimation(animationId);
		if (!animation) {
			res.status(404).json(apiResponse.error("Animation not found", "ANIMATION_NOT_FOUND"));
			return;
		}

		ActivityService.log({
			userId: req.user!.id,
			action: "unpublish",
			module: "animations",
			itemType: "animation",
			itemId: animation.id,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been unpublished`,
		});

		res.json(apiResponse.success(animation));
	}

	async bulkPublishAnimations(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await animationsService.bulkPublishAnimations(ids);

		if (result.publishedAnimations?.length) {
			await ActivityService.logMany(
				result.publishedAnimations.map((animation) => ({
					userId: req.user!.id,
					action: "publish",
					module: "animations",
					itemType: "animation",
					itemId: animation.id,
					itemTitle: animation.title,
					description: `**${animation.title}** animation has been published`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				publishedIds: result.publishedIds,
				failed: result.skipped.map((s) => ({
					id: s.id,
					title: s.title,
					error: s.reason,
				})),
			}),
		);
	}

	async bulkUnpublishAnimations(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await animationsService.bulkUnpublishAnimations(ids);

		if (result.unpublishedAnimations?.length) {
			await ActivityService.logMany(
				result.unpublishedAnimations.map((animation) => ({
					userId: req.user!.id,
					action: "unpublish",
					module: "animations",
					itemType: "animation",
					itemId: animation.id,
					itemTitle: animation.title,
					description: `**${animation.title}** animation has been unpublished`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				unpublishedIds: result.unpublishedIds,
				failed: result.skipped.map((s) => ({
					id: s.id,
					title: s.title,
					error: s.reason,
				})),
			}),
		);
	}

	async bulkDeleteAnimations(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await animationsService.bulkDeleteAnimations(ids);

		if (result.deletedAnimations?.length) {
			await ActivityService.logMany(
				result.deletedAnimations.map((animation) => ({
					userId: req.user!.id,
					action: "delete",
					module: "animations",
					itemType: "animation",
					itemId: animation.id,
					itemTitle: animation.title,
					description: `**${animation.title}** animation has been deleted`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				deletedIds: result.deletedIds,
				skipped: result.skipped,
			}),
		);
	}

	async bulkPurgeAnimations(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await animationsService.bulkPurgeAnimations(ids);

		if (result.purgedAnimations?.length) {
			await ActivityService.logMany(
				result.purgedAnimations.map((animation) => ({
					userId: req.user!.id,
					action: "delete",
					module: "animations",
					itemType: "animation",
					itemId: animation.id,
					itemTitle: animation.title,
					description: `**${animation.title}** animation has been purged`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				purgedIds: result.purgedIds,
				skipped: result.skipped,
			}),
		);
	}

	async reorderAnimations(req: Request, res: Response) {
		const { animationIds } = reorderAnimationsSchema.parse(req.body);

		const result = await animationsService.reorderAnimations(animationIds);

		res.json(apiResponse.success(result));
	}

	async revertToRevision(req: Request, res: Response) {
		const animationId = parseInt(req.params.id as string);
		const revisionId = parseInt(req.params.revisionId as string);

		if (isNaN(animationId) || isNaN(revisionId)) {
			res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));
			return;
		}

		const animation = await animationsService.revertToRevision(animationId, revisionId, req.user!.id);

		if (!animation) {
			res.status(404).json(apiResponse.error("Animation or revision not found", "NOT_FOUND"));
			return;
		}

		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "animations",
			itemType: "animation",
			itemId: animation.id,
			itemTitle: animation.title,
			description: `**${animation.title}** animation has been reverted to revision **${revisionId}**`,
		});

		res.json(apiResponse.success(serializeAnimation(animation)));
	}
}

export const animationsController = new AnimationsController();
