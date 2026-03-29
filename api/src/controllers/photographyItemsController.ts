import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { photographyItemsService } from "../services/photographyItemsService";
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
	title: z.string().min(1),
	description: z.string().default(""),
	imageId: z.number().int(),
	photographerId: z.number().int(),
	categoryId: z.number().int(),
	client: z.string().optional(),
	agency: z.string().optional(),
	year: z.number().int().optional().nullable(),
	location: z.string().default(""),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

const updateSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	photographerId: z.number().int().optional(),
	client: z.string().optional(),
	agency: z.string().optional(),
	year: z.number().int().optional().nullable(),
	location: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
	// Relation IDs
	clientIds: z.array(z.number().int()).optional(),
	agencyIds: z.array(z.number().int()).optional(),
	starringIds: z.array(z.number().int()).optional(),
	categoryIds: z.array(z.number().int()).optional(),
});

export class PhotographyItemsController {
	async list(req: Request, res: Response, next: NextFunction) {
		try {
			const photographerId = req.query.photographerId ? parseInt(String(req.query.photographerId)) : undefined;
			const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId)) : undefined;

			const items = await photographyItemsService.listByParent({
				photographerId,
				categoryId,
			});
			res.json(
				apiResponse.success(items, {
					pagination: {
						page: 1,
						limit: items.length,
						total: items.length,
						totalPages: 1,
					},
				}),
			);
		} catch (err) {
			next(err);
		}
	}

	async create(req: Request, res: Response, next: NextFunction) {
		try {
			const data = createSchema.parse(req.body);
			const item = await photographyItemsService.createItem(data);

			const categoryNames =
				item.categories
					?.map((c) => c.category?.title)
					.filter(Boolean)
					.join(", ") || "No category";
			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "photography",
				itemType: "photo",
				itemId: item.id,
				itemTitle: item.title,
				description: `**${item.title}** photo associated with **${item.photographer.title}** and **${categoryNames}** has been created`,
				metadata: data,
			});

			res.status(201).json(apiResponse.success(item));
		} catch (err) {
			next(err);
		}
	}

	async update(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const data = updateSchema.parse(req.body);
			const item = await photographyItemsService.updateItem(id, data);

			const categoryNames =
				item.categories
					?.map((c) => c.category?.title)
					.filter(Boolean)
					.join(", ") || "No category";
			if (data.status) {
				const action = data.status === "PUBLISHED" ? "publish" : "unpublish";
				const actionText = data.status === "PUBLISHED" ? "published" : "unpublished";
				await ActivityService.log({
					userId: req.user!.id,
					action,
					module: "photography",
					itemType: "photo",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** photo associated with **${item.photographer.title}** and **${categoryNames}** has been ${actionText}`,
					metadata: data,
				});
			} else {
				await ActivityService.log({
					userId: req.user!.id,
					action: "update",
					module: "photography",
					itemType: "photo",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** photo associated with **${item.photographer.title}** and **${categoryNames}** has been updated`,
					metadata: data,
				});
			}

			res.json(apiResponse.success(item));
		} catch (err) {
			next(err);
		}
	}

	async reorder(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({
				parentType: z.enum(["photographer", "category"]),
				parentId: z.number().int(),
				orderedIds: z.array(z.number().int()).min(1),
			});
			const data = schema.parse(req.body);
			const parent =
				data.parentType === "photographer" ? { photographerId: data.parentId } : { categoryId: data.parentId };
			await photographyItemsService.reorder(parent, data.orderedIds);
			res.json(apiResponse.success({ ok: true }));
		} catch (err) {
			next(err);
		}
	}

	async moveToClient(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const schema = z.object({
				clientId: z.number().int().nullable(),
			});
			const { clientId } = schema.parse(req.body);
			await photographyItemsService.moveToClient(id, clientId);
			res.json(apiResponse.success({ ok: true }));
		} catch (err) {
			next(err);
		}
	}

	async reorderGroups(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({
				photographerId: z.number().int(),
				groupOrder: z.array(
					z.object({
						clientId: z.number().int().nullable(),
						itemIds: z.array(z.number().int()),
					}),
				),
			});
			const data = schema.parse(req.body);
			await photographyItemsService.reorderGroups(data.photographerId, data.groupOrder);
			res.json(apiResponse.success({ ok: true }));
		} catch (err) {
			next(err);
		}
	}

	async delete(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const deletedItem = await photographyItemsService.delete(id);

			if (deletedItem) {
				const categoryNames =
					deletedItem.categories
						?.map((c) => c.category?.title)
						.filter(Boolean)
						.join(", ") || "No category";
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "photography",
					itemType: "photo",
					itemId: id,
					itemTitle: deletedItem.title,
					description: `**${deletedItem.title}** photo associated with **${deletedItem.photographer.title}** and **${categoryNames}** has been deleted`,
				});
			}

			res.status(204).send();
		} catch (err) {
			next(err);
		}
	}

	async bulkCreate(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({
				photographerId: z.number().int().optional(),
				categoryIds: z.array(z.number().int()).optional(),
				clientIds: z.array(z.number().int()).optional(),
				agencyIds: z.array(z.number().int()).optional(),
				starringIds: z.array(z.number().int()).optional(),
				items: z
					.array(
						z.object({
							imageId: z.number().int(),
							title: z.string().min(1),
							description: z.string().optional(),
							year: z.number().int().optional().nullable(),
							location: z.string().optional(),
							client: z.string().optional(),
							agency: z.string().optional(),
							categoryIds: z.array(z.number().int()).optional(),
							photographerId: z.number().int().optional(),
						}),
					)
					.min(1),
			});

			const data = schema.parse(req.body);
			const items = await photographyItemsService.bulkCreate(data);

			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "photography",
				itemType: "photo",
				itemId: items[0]?.id || 0,
				itemTitle: `Bulk create (${items.length} items)`,
				description: `**${items.length}** photos have been bulk created`,
				metadata: { count: items.length },
			});

			res.status(201).json(apiResponse.success(items));
		} catch (err) {
			next(err);
		}
	}
}

export const photographyItemsController = new PhotographyItemsController();
