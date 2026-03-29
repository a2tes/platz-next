import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { photoCategoriesService } from "../services/photoCategoriesService";
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
	ogImageId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
const updateSchema = createSchema.partial();
const listSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	sortBy: z.enum(["title", "createdAt", "updatedAt"]).default("title"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	status: z.enum(["DRAFT", "PUBLISHED", "ALL"]).default("ALL"),
	mine: z.boolean().optional(),
});

export class PhotoCategoriesController {
	async create(req: Request, res: Response, next: NextFunction) {
		try {
			console.log("📝 Create category request body:", req.body);
			const data = createSchema.parse(req.body);
			console.log("✅ Validated data:", data);
			const category = await photoCategoriesService.createCategory({
				...data,
				createdBy: req.user!.id,
			} as any);

			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "photography",
				itemType: "category",
				itemId: category.id,
				itemTitle: category.title,
				description: `**${category.title}** category has been created`,
			});

			res.status(201).json(apiResponse.success(category));
		} catch (err) {
			console.error("❌ Create category error:", err);
			next(err);
		}
	}

	async list(req: Request, res: Response, next: NextFunction) {
		try {
			const query = listSchema.parse({
				page: req.query.page ? parseInt(String(req.query.page)) : undefined,
				limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
				status: req.query.status as string,
				mine: req.query.mine === "true",
			});

			const result = await photoCategoriesService.getCategories(query, {
				currentUserId: req.user?.id,
			});
			res.json(
				apiResponse.success(result.categories, {
					pagination: result.pagination,
				}),
			);
		} catch (err) {
			next(err);
		}
	}

	async getCounts(req: Request, res: Response, next: NextFunction) {
		try {
			const counts = await photoCategoriesService.getFilterCounts(req.user!.id);
			res.json(apiResponse.success(counts));
		} catch (err) {
			next(err);
		}
	}

	async getById(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			if (isNaN(id)) return res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));
			const item = await photoCategoriesService.getCategoryById(id, {
				includeTrashed: true,
			});
			if (!item) return res.status(404).json(apiResponse.error("Category not found", "NOT_FOUND"));
			res.json(apiResponse.success(item));
		} catch (err) {
			next(err);
		}
	}

	async update(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			if (isNaN(id)) return res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));

			const data = updateSchema.parse(req.body);
			const item = await photoCategoriesService.updateCategory(id, data);

			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: item.title,
				description: `**${item.title}** category has been updated`,
			});

			res.json(apiResponse.success(item));
		} catch (err) {
			next(err);
		}
	}

	async delete(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			if (isNaN(id)) return res.status(400).json(apiResponse.error("Invalid ID", "INVALID_ID"));

			const existing = await photoCategoriesService.getCategoryById(id);
			if (!existing) return res.status(404).json(apiResponse.error("Category not found", "NOT_FOUND"));

			await photoCategoriesService.deleteCategory(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: existing.title,
				description: `The category **${existing.title}** has been deleted`,
			});
			res.json(apiResponse.success({ message: "Category moved to Trash" }));
		} catch (err) {
			next(err);
		}
	}

	async trash(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const existing = await photoCategoriesService.getCategoryById(id);
			if (!existing) return res.status(404).json(apiResponse.error("Category not found", "NOT_FOUND"));

			await photoCategoriesService.trashCategory(id);

			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: existing.title,
				description: `The category **${existing.title}** has been deleted`,
			});

			res.json(apiResponse.success({ message: "Moved to Trash" }));
		} catch (err) {
			next(err);
		}
	}

	async restore(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const existing = await photoCategoriesService.getCategoryById(id, {
				includeTrashed: true,
			});
			if (!existing) return res.status(404).json(apiResponse.error("Category not found", "NOT_FOUND"));

			await photoCategoriesService.restoreCategory(id);

			await ActivityService.log({
				userId: req.user!.id,
				action: "restore",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: existing.title,
				description: `**${existing.title}** category has been restored`,
			});

			res.json(apiResponse.success({ message: "Restored" }));
		} catch (err) {
			next(err);
		}
	}

	async purge(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const existing = await photoCategoriesService.getCategoryById(id, {
				includeTrashed: true,
			});
			if (!existing) return res.status(404).json(apiResponse.error("Category not found", "NOT_FOUND"));

			await photoCategoriesService.purgeCategory(id);

			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: existing.title,
				description: `**${existing.title}** category has been permanently deleted`,
			});

			res.json(apiResponse.success({ message: "Category permanently deleted" }));
		} catch (err) {
			next(err);
		}
	}

	async publish(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const item = await photoCategoriesService.publishCategory(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: item.title,
				description: `**${item.title}** category has been published`,
			});
			res.json(apiResponse.success(item));
		} catch (err) {
			next(err);
		}
	}

	async unpublish(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const item = await photoCategoriesService.unpublishCategory(id);
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "photography",
				itemType: "category",
				itemId: id,
				itemTitle: item.title,
				description: `**${item.title}** category has been unpublished`,
			});
			res.json(apiResponse.success(item));
		} catch (err) {
			next(err);
		}
	}

	async getTrashed(req: Request, res: Response, next: NextFunction) {
		try {
			const query = listSchema.parse({
				page: req.query.page ? parseInt(String(req.query.page)) : 1,
				limit: req.query.limit ? parseInt(String(req.query.limit)) : 20,
				search: req.query.search as string,
				sortBy: req.query.sortBy as string,
				sortOrder: req.query.sortOrder as string,
			});

			const result = await photoCategoriesService.getTrashedCategories(query);
			res.json(
				apiResponse.success(result.categories, {
					pagination: result.pagination,
				}),
			);
		} catch (err) {
			next(err);
		}
	}

	async reorder(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({ orderedIds: z.array(z.number().int()).min(1) });
			const { orderedIds } = schema.parse(req.body);
			await photoCategoriesService.reorder(orderedIds);
			res.json(apiResponse.success({ message: "Reordered" }));
		} catch (err) {
			next(err);
		}
	}

	/**
	 * Bulk delete categories (move to Trash)
	 */
	async bulkDeleteCategories(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({ ids: z.array(z.number()).min(1) });
			const { ids } = schema.parse(req.body);

			const result = await photoCategoriesService.bulkDeleteCategories(ids);

			for (const item of result.deleted) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "photography",
					itemType: "category",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** category has been deleted`,
				});
			}

			res.json(
				apiResponse.success({
					deletedIds: result.deleted.map((d) => d.id),
					skipped: result.skipped,
				}),
			);
		} catch (err) {
			next(err);
		}
	}

	/**
	 * Bulk purge categories
	 */
	async bulkPurgeCategories(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({ ids: z.array(z.number()).min(1) });
			const { ids } = schema.parse(req.body);

			const result = await photoCategoriesService.bulkPurgeCategories(ids);

			for (const item of result.purged) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "photography",
					itemType: "category",
					itemId: item.id,
					itemTitle: item.title,
					description: `**${item.title}** category has been permanently deleted`,
				});
			}

			res.json(
				apiResponse.success({
					purgedIds: result.purged.map((p) => p.id),
					skipped: result.skipped,
				}),
			);
		} catch (err) {
			next(err);
		}
	}

	/**
	 * Search categories for autocomplete
	 * GET /api/photography/categories/search
	 */
	async searchCategories(req: Request, res: Response, next: NextFunction) {
		try {
			const { q, limit } = req.query;
			const searchLimit = limit ? parseInt(limit as string) : 10;

			const categories = await photoCategoriesService.searchCategories((q as string) || "", searchLimit);

			res.json({ data: categories.map((c) => ({ id: c.id, name: c.title, slug: c.slug })) });
		} catch (err) {
			next(err);
		}
	}

	/**
	 * Find or create a category by name
	 * POST /api/photography/categories/find-or-create
	 */
	async findOrCreateCategory(req: Request, res: Response, next: NextFunction) {
		try {
			const schema = z.object({ name: z.string().min(1) });
			const { name } = schema.parse(req.body);

			const category = await photoCategoriesService.findOrCreate(name);

			res.json({ data: { id: category.id, name: category.title, slug: category.slug } });
		} catch (err) {
			next(err);
		}
	}
}

export const photoCategoriesController = new PhotoCategoriesController();
