import { Request, Response } from "express";
import { worksService } from "../services/worksService";
import { ActivityService } from "../services/activityService";
import { z } from "zod";
import { serializeWork } from "../utils/serialization";

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
const createWorkSchema = z.object({
	title: z.string().min(1).max(191),
	shortDescription: z.string().optional(),
	subtitle: z.string().max(255).optional(),
	caseStudy: z.string().optional(),
	client: z.string().max(191).optional(),
	agency: z.string().max(191).optional(),
	tags: z.array(z.string()).default([]),
	videoFileId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
	directorIds: z.array(z.number()).default([]),
	starringIds: z.array(z.number()).default([]),
	clientIds: z.array(z.number()).default([]),
	agencyIds: z.array(z.number()).default([]),
	disciplineIds: z.array(z.number()).default([]),
	sectorIds: z.array(z.number()).default([]),
});

const updateWorkSchema = createWorkSchema.partial();

const getWorksSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "ALL"]).default("ALL"),
	sortBy: z.enum(["title", "client", "createdAt", "updatedAt", "sortOrder"]).default("sortOrder"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const reorderWorksSchema = z.object({
	workIds: z.array(z.number()).min(1),
});

export class WorksController {
	async getWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		// Allow fetching trashed works so users can still edit/restore them
		const work = await worksService.getWorkById(workId, {
			includeTrashed: true,
		});
		if (!work) {
			res.status(404).json(apiResponse.error("Work not found", "WORK_NOT_FOUND"));
			return;
		}

		res.json(apiResponse.success(serializeWork(work)));
	}

	async getWorks(req: Request, res: Response) {
		const query = getWorksSchema.extend({ mine: z.coerce.boolean().optional() }).parse({
			page: req.query.page ? parseInt(req.query.page as string) : undefined,
			limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
			search: req.query.search as string,
			status: req.query.status as string,
			sortBy: req.query.sortBy as string,
			sortOrder: req.query.sortOrder as string,
			mine: req.query.mine as any,
		});

		const result = await worksService.getWorks(query, {
			currentUserId: req.user?.id,
		});

		res.json(
			apiResponse.success(result.works.map(serializeWork), {
				pagination: result.pagination,
			}),
		);
	}

	async getCounts(req: Request, res: Response) {
		const counts = await worksService.getFilterCounts(req.user!.id);
		res.json(apiResponse.success(counts));
	}

	async getTrashedWorks(req: Request, res: Response) {
		const query = getWorksSchema
			.omit({ status: true })
			.extend({ status: z.enum(["DRAFT", "PUBLISHED", "ALL"]).optional() })
			.parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
			});

		const result = await worksService.getTrashedWorks(query);
		res.json(
			apiResponse.success(result.works.map(serializeWork), {
				pagination: result.pagination,
			}),
		);
	}

	async createWork(req: Request, res: Response) {
		const data = createWorkSchema.parse(req.body);

		const work = await worksService.createWork(data, req.user!.id);

		ActivityService.log({
			userId: req.user!.id,
			action: "create",
			module: "works",
			itemType: "work",
			itemId: work.id,
			itemTitle: work.title,
			description: `**${work.title}** work has been created`,
			metadata: data,
		});

		res.status(201).json(apiResponse.success(serializeWork(work)));
	}

	async updateWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		const data = updateWorkSchema.parse(req.body);

		const work = await worksService.updateWork(workId, data, req.user!.id);
		if (!work) {
			res.status(404).json(apiResponse.error("Work not found", "WORK_NOT_FOUND"));
			return;
		}
		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "works",
			itemType: "work",
			itemId: work.id,
			itemTitle: work.title,
			description: `**${work.title}** work has been updated`,
			metadata: data,
		});

		res.json(apiResponse.success(serializeWork(work)));
	}

	async updateWorkTitle(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		const { title } = req.body;
		if (!title || typeof title !== "string") {
			res.status(400).json(apiResponse.error("Title is required", "INVALID_TITLE"));
			return;
		}

		const work = await worksService.updateWorkTitle(workId, title, req.user?.id);
		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "works",
			itemType: "work",
			itemId: workId,
			itemTitle: work.title,
			description: `**${work.title}** work has been updated`,
		});

		res.json(apiResponse.success(serializeWork(work)));
	}

	async deleteWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		// Get work info before deletion for logging
		const work = await worksService.getWorkById(workId);
		if (!work) {
			res.status(404).json(apiResponse.error("Work not found", "WORK_NOT_FOUND"));
			return;
		}

		await worksService.deleteWork(workId);

		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "works",
			itemType: "work",
			itemId: workId,
			itemTitle: work.title,
			description: `**${work.title}** work has been deleted`,
		});

		res.json(apiResponse.success({ message: "Work moved to Trash" }));
	}

	async trashWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		const work = await worksService.trashWork(workId);
		const workTitle = (work as any).title ?? `Work ${workId}`;
		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "works",
			itemType: "work",
			itemId: workId,
			itemTitle: workTitle,
			description: `**${workTitle}** work has been deleted`,
		});
		res.json(apiResponse.success({ message: "Moved to Trash" }));
	}

	async restoreWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		await worksService.restoreWork(workId);
		const work = await worksService.getWorkById(workId);
		ActivityService.log({
			userId: req.user!.id,
			action: "restore",
			module: "works",
			itemType: "work",
			itemId: workId,
			itemTitle: work?.title,
			description: `**${work?.title}** has been restored`,
		});
		res.json(apiResponse.success({ message: "Restored from Trash" }));
	}

	async purgeWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		const work = await worksService.getWorkById(workId, {
			includeTrashed: true,
		});
		await worksService.purgeWork(workId);
		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "works",
			itemType: "work",
			itemId: workId,
			itemTitle: work?.title,
			description: `**${work?.title}** has been permanently deleted`,
		});
		res.json(apiResponse.success({ message: "Purged successfully" }));
	}

	async publishWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		const work = await worksService.publishWork(workId);
		if (!work) {
			res.status(404).json(apiResponse.error("Work not found", "WORK_NOT_FOUND"));
			return;
		}

		ActivityService.log({
			userId: req.user!.id,
			action: "publish",
			module: "works",
			itemType: "work",
			itemId: work.id,
			itemTitle: work.title,
			description: `**${work.title}** work has been published`,
		});

		res.json(apiResponse.success(work));
	}

	async unpublishWork(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		if (isNaN(workId)) {
			res.status(400).json(apiResponse.error("Invalid work ID", "INVALID_ID"));
			return;
		}

		const work = await worksService.unpublishWork(workId);
		if (!work) {
			res.status(404).json(apiResponse.error("Work not found", "WORK_NOT_FOUND"));
			return;
		}

		ActivityService.log({
			userId: req.user!.id,
			action: "unpublish",
			module: "works",
			itemType: "work",
			itemId: work.id,
			itemTitle: work.title,
			description: `**${work.title}** work has been unpublished`,
		});

		res.json(apiResponse.success(work));
	}

	async bulkPublishWorks(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await worksService.bulkPublishWorks(ids);

		if (result.publishedWorks?.length) {
			await ActivityService.logMany(
				result.publishedWorks.map((work) => ({
					userId: req.user!.id,
					action: "publish",
					module: "works",
					itemType: "work",
					itemId: work.id,
					itemTitle: work.title,
					description: `**${work.title}** work has been published`,
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

	async bulkUnpublishWorks(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await worksService.bulkUnpublishWorks(ids);

		if (result.unpublishedWorks?.length) {
			await ActivityService.logMany(
				result.unpublishedWorks.map((work) => ({
					userId: req.user!.id,
					action: "unpublish",
					module: "works",
					itemType: "work",
					itemId: work.id,
					itemTitle: work.title,
					description: `**${work.title}** work has been unpublished`,
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

	async bulkDeleteWorks(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await worksService.bulkDeleteWorks(ids);

		if (result.deletedWorks?.length) {
			await ActivityService.logMany(
				result.deletedWorks.map((work) => ({
					userId: req.user!.id,
					action: "delete",
					module: "works",
					itemType: "work",
					itemId: work.id,
					itemTitle: work.title,
					description: `**${work.title}** work has been deleted`,
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

	async bulkPurgeWorks(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await worksService.bulkPurgeWorks(ids);

		if (result.purgedWorks?.length) {
			await ActivityService.logMany(
				result.purgedWorks.map((work) => ({
					userId: req.user!.id,
					action: "delete",
					module: "works",
					itemType: "work",
					itemId: work.id,
					itemTitle: work.title,
					description: `**${work.title}** work has been purged`,
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

	async reorderWorks(req: Request, res: Response) {
		const { workIds } = reorderWorksSchema.parse(req.body);

		const result = await worksService.reorderWorks(workIds);

		res.json(apiResponse.success(result));
	}

	async revertToRevision(req: Request, res: Response) {
		const workId = parseInt(req.params.id as string);
		const revisionId = parseInt(req.params.revisionId as string);

		if (isNaN(workId) || isNaN(revisionId)) {
			res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));
			return;
		}

		const work = await worksService.revertToRevision(workId, revisionId, req.user!.id);

		if (!work) {
			res.status(404).json(apiResponse.error("Work or revision not found", "NOT_FOUND"));
			return;
		}

		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "works",
			itemType: "work",
			itemId: work.id,
			itemTitle: work.title,
			description: `**${work.title}** work has been reverted to revision **${revisionId}**`,
		});

		res.json(apiResponse.success(serializeWork(work)));
	}
}

export const worksController = new WorksController();
