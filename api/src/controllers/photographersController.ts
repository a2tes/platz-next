import { Request, Response } from "express";
import { z } from "zod";
import { photographersService } from "../services/photographersService";
import { ActivityService } from "../services/activityService";

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

const createSchema = z.object({
	title: z.string().min(1).max(191),
	bio: z.string().optional(),
	avatarId: z.number().nullable().optional(),
	coverImageId: z.number().nullable().optional(),
	groupByClient: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
const updateSchema = createSchema.partial();
const listSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	sortBy: z.enum(["title", "createdAt", "updatedAt"]).default("title"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	mine: z.boolean().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export class PhotographersController {
	async create(req: Request, res: Response) {
		const data = createSchema.parse(req.body);
		const item = await photographersService.create({
			...data,
			createdBy: req.user!.id,
		} as any);
		ActivityService.log({
			userId: req.user!.id,
			action: "create",
			module: "photography",
			itemType: "photographer",
			itemId: item.id,
			itemTitle: item.title,
			description: `**${item.title}** photographer has been created`,
		});
		res.status(201).json(apiResponse.success(item));
	}

	async list(req: Request, res: Response) {
		const query = listSchema.parse({
			page: req.query.page ? parseInt(String(req.query.page)) : undefined,
			limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
			search: req.query.search as string,
			sortBy: req.query.sortBy as string,
			sortOrder: req.query.sortOrder as string,
			mine: req.query.mine === "true",
			status: req.query.status as string,
		});
		const result = await photographersService.list(query, {
			currentUserId: req.user?.id,
		});
		res.json(
			apiResponse.success(result.photographers, {
				pagination: result.pagination,
			}),
		);
	}

	async listTrashed(req: Request, res: Response) {
		const query = listSchema.parse({
			page: req.query.page ? parseInt(String(req.query.page)) : undefined,
			limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
			search: req.query.search as string,
			sortBy: req.query.sortBy as string,
			sortOrder: req.query.sortOrder as string,
		});
		const result = await photographersService.list(query, {
			currentUserId: req.user?.id,
			includeTrashed: true,
		});
		res.json(
			apiResponse.success(result.photographers, {
				pagination: result.pagination,
			}),
		);
	}

	async getCounts(req: Request, res: Response) {
		const counts = await photographersService.getFilterCounts(req.user!.id);
		res.json(apiResponse.success(counts));
	}

	async getById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));
		const item = await photographersService.getById(id, {
			includeTrashed: true,
		});
		if (!item) return res.status(404).json(apiResponse.error("Photographer not found", "NOT_FOUND"));
		res.json(apiResponse.success(item));
	}

	async update(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));
		const data = updateSchema.parse(req.body);
		const item = await photographersService.update(id, data);
		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: item.title,
			description: `**${item.title}** photographer has been updated`,
		});
		res.json(apiResponse.success(item));
	}

	async delete(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));

		const existing = await photographersService.getById(id);
		if (!existing) return res.status(404).json(apiResponse.error("Photographer not found", "NOT_FOUND"));

		await photographersService.delete(id);
		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: existing.title,
			description: `The photographer **${existing.title}** has been deleted`,
		});
		res.json(apiResponse.success({ message: "Photographer moved to Trash" }));
	}

	async trash(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		const existing = await photographersService.getById(id);
		if (!existing) return res.status(404).json(apiResponse.error("Photographer not found", "NOT_FOUND"));

		await photographersService.trash(id);

		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: existing.title,
			description: `The photographer **${existing.title}** has been deleted`,
		});

		res.json(apiResponse.success({ message: "Moved to Trash" }));
	}

	async restore(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		const existing = await photographersService.getById(id, {
			includeTrashed: true,
		});
		if (!existing) return res.status(404).json(apiResponse.error("Photographer not found", "NOT_FOUND"));

		await photographersService.restore(id);

		ActivityService.log({
			userId: req.user!.id,
			action: "restore",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: existing.title,
			description: `**${existing.title}** photographer has been restored`,
		});

		res.json(apiResponse.success({ message: "Restored" }));
	}

	async purge(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		const existing = await photographersService.getById(id, {
			includeTrashed: true,
		});
		if (!existing) return res.status(404).json(apiResponse.error("Photographer not found", "NOT_FOUND"));

		await photographersService.purge(id);

		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: existing.title,
			description: `**${existing.title}** photographer has been permanently deleted`,
		});

		res.json(apiResponse.success({ message: "Photographer permanently deleted" }));
	}

	async publish(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		const photographer = await photographersService.update(id, {
			status: "PUBLISHED",
		});
		ActivityService.log({
			userId: req.user!.id,
			action: "publish",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: photographer.title,
			description: `**${photographer.title}** photographer has been published`,
		});
		res.json(apiResponse.success(photographer));
	}

	async unpublish(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		const photographer = await photographersService.update(id, {
			status: "DRAFT",
		});
		ActivityService.log({
			userId: req.user!.id,
			action: "unpublish",
			module: "photography",
			itemType: "photographer",
			itemId: id,
			itemTitle: photographer.title,
			description: `**${photographer.title}** photographer has been unpublished`,
		});
		res.json(apiResponse.success(photographer));
	}

	async updateTitle(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		const { title } = req.body;

		if (!title || typeof title !== "string") {
			return res.status(400).json(apiResponse.error("Title is required", "INVALID_INPUT"));
		}

		// Get old info for logging
		const oldPhotographer = await photographersService.getById(id);

		const photographer = await photographersService.updateTitle(id, title);

		if (oldPhotographer) {
			ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "photography",
				itemType: "photographer",
				itemId: id,
				itemTitle: photographer.title,
				description: `**${oldPhotographer.title}** photographer has been renamed to **${photographer.title}**`,
			});
		}

		res.json(apiResponse.success(photographer));
	}

	async reorder(req: Request, res: Response) {
		const schema = z.object({
			orderedIds: z.array(z.number().int()).min(1),
		});
		const { orderedIds } = schema.parse(req.body);
		await photographersService.reorder(orderedIds);
		res.json(apiResponse.success({ message: "Reordered" }));
	}

	async bulkDeletePhotographers(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await photographersService.bulkDeletePhotographers(ids);

		if (result.deleted.length > 0) {
			ActivityService.logMany(
				result.deleted.map((item) => ({
					userId: req.user!.id,
					action: "delete",
					module: "photography",
					itemType: "photographer",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** photographer has been deleted`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				deletedIds: result.deleted.map((d) => d.id),
				skipped: result.skipped,
			}),
		);
	}

	async bulkPurgePhotographers(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await photographersService.bulkPurgePhotographers(ids);

		if (result.purged.length > 0) {
			ActivityService.logMany(
				result.purged.map((item) => ({
					userId: req.user!.id,
					action: "delete",
					module: "photography",
					itemType: "photographer",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** photographer has been permanently deleted`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				purgedIds: result.purged.map((p) => p.id),
				skipped: result.skipped,
			}),
		);
	}

	async bulkPublishPhotographers(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await photographersService.bulkPublishPhotographers(ids);

		if (result.published.length > 0) {
			ActivityService.logMany(
				result.published.map((item) => ({
					userId: req.user!.id,
					action: "publish",
					module: "photography",
					itemType: "photographer",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** photographer has been published`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				publishedIds: result.published.map((p) => p.id),
				skipped: result.skipped,
			}),
		);
	}

	async bulkUnpublishPhotographers(req: Request, res: Response) {
		const schema = z.object({ ids: z.array(z.number()).min(1) });
		const { ids } = schema.parse(req.body);

		const result = await photographersService.bulkUnpublishPhotographers(ids);

		if (result.unpublished.length > 0) {
			ActivityService.logMany(
				result.unpublished.map((item) => ({
					userId: req.user!.id,
					action: "unpublish",
					module: "photography",
					itemType: "photographer",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** photographer has been unpublished`,
				})),
			);
		}

		res.json(
			apiResponse.success({
				unpublishedIds: result.unpublished.map((p) => p.id),
				skipped: result.skipped,
			}),
		);
	}
}

export const photographersController = new PhotographersController();
