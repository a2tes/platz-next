import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { contentPagesService } from "../services/contentPagesService";
import { ApiResponse } from "../utils/apiResponse";
import { PageType, Status } from "@prisma/client";
import { ActivityService } from "../services/activityService";
import { serializeContentPage } from "../utils/serialization";

// EditorJS format (legacy)
const editorJSBlocksSchema = z.object({
	time: z.number().optional(),
	blocks: z.array(z.any()),
	version: z.string().optional(),
});

// Quill format (new)
const quillDataSchema = z.object({
	html: z.string(),
	format: z.literal("quill"),
});

// Accept either EditorJS or Quill format
const contentBlocksSchema = z.union([editorJSBlocksSchema, quillDataSchema]);

const updateSchema = z.object({
	title: z.string().min(1).max(191).optional(),
	contentBlocks: contentBlocksSchema.optional(),
	mapEmbed: z.string().nullable().optional(),
	metaDescription: z.string().nullable().optional(),
	metaKeywords: z.string().nullable().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

const createSchema = z.object({
	title: z.string().min(1).max(191),
	contentBlocks: contentBlocksSchema.optional(),
	mapEmbed: z.string().nullable().optional(),
	metaDescription: z.string().nullable().optional(),
	metaKeywords: z.string().nullable().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

class ContentPagesController {
	async getAbout(req: Request, res: Response) {
		const page = await contentPagesService.getByType(PageType.ABOUT);
		if (!page) return ApiResponse.notFound(res, "About page not found");
		return ApiResponse.success(res, serializeContentPage(page));
	}

	async updateAbout(req: Request, res: Response) {
		const data = updateSchema.parse(req.body);
		const updated = await contentPagesService.updateByType(PageType.ABOUT, {
			title: data.title,
			// Preserve existing blocks unless explicitly provided
			contentBlocks: data.contentBlocks === undefined ? undefined : data.contentBlocks,
			metaDescription: data.metaDescription ?? undefined,
			metaKeywords: data.metaKeywords ?? undefined,
			previewImageId: data.previewImageId ?? undefined,
			status: data.status as Status | undefined,
		});

		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "content",
			itemType: "page",
			itemId: updated.id,
			itemTitle: updated.title,
			description: `**${updated.title}** page has been updated`,
		});
		return ApiResponse.success(res, serializeContentPage(updated));
	}

	async getContact(req: Request, res: Response) {
		const page = await contentPagesService.getByType(PageType.CONTACT);
		if (!page) return ApiResponse.notFound(res, "Contact page not found");
		return ApiResponse.success(res, serializeContentPage(page));
	}

	async updateContact(req: Request, res: Response) {
		const data = updateSchema.parse(req.body);
		const updated = await contentPagesService.updateByType(PageType.CONTACT, {
			title: data.title,
			// Preserve existing blocks unless explicitly provided
			contentBlocks: data.contentBlocks === undefined ? undefined : data.contentBlocks,
			mapEmbed: data.mapEmbed ?? undefined,
			metaDescription: data.metaDescription ?? undefined,
			metaKeywords: data.metaKeywords ?? undefined,
			previewImageId: data.previewImageId ?? undefined,
			status: data.status as Status | undefined,
		});

		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "content",
			itemType: "page",
			itemId: updated.id,
			itemTitle: updated.title,
			description: `**${updated.title}** page has been updated`,
		});
		return ApiResponse.success(res, serializeContentPage(updated));
	}

	async getLegal(req: Request, res: Response) {
		const pages = await contentPagesService.listByType(PageType.LEGAL);
		return ApiResponse.success(res, pages.map(serializeContentPage));
	}

	async createLegal(req: Request, res: Response) {
		const data = createSchema.parse(req.body);
		const created = await contentPagesService.create(PageType.LEGAL, {
			...data,
			// record creator
			createdBy: req.user!.id,
		});
		ActivityService.log({
			userId: req.user!.id,
			action: "create",
			module: "content",
			itemType: "page",
			itemId: created.id,
			itemTitle: created.title,
			description: `**${created.title}** page has been created`,
		});
		return ApiResponse.success(res, serializeContentPage(created));
	}

	async getLegalPaginated(req: Request, res: Response) {
		const search = (req.query.search as string) || undefined;
		const statusQ = (req.query.status as string) || undefined;
		const status = statusQ === "PUBLISHED" || statusQ === "DRAFT" ? (statusQ as Status) : undefined;
		const page = Math.max(parseInt(String(req.query.page || "1")), 1);
		const limit = Math.max(parseInt(String(req.query.limit || "25")), 1);
		const mine = String(req.query.mine || "false") === "true";

		const result = await contentPagesService.listLegalPaginated({
			search,
			status,
			page,
			limit,
			mineUserId: mine ? req.user!.id : undefined,
		});

		// Serialize preview images
		const serialized = {
			data: result.data.map(serializeContentPage),
			meta: result.meta,
		};
		return ApiResponse.success(res, serialized);
	}

	async getLegalTrashedPaginated(req: Request, res: Response, next: NextFunction) {
		const search = (req.query.search as string) || undefined;
		const page = Math.max(parseInt(String(req.query.page || "1")), 1);
		const limit = Math.max(parseInt(String(req.query.limit || "25")), 1);

		const result = await contentPagesService.listLegalTrashedPaginated({
			search,
			page,
			limit,
		});

		const serialized = {
			data: result.data.map(serializeContentPage),
			meta: result.meta,
		};
		return ApiResponse.success(res, serialized);
	}

	async getLegalCounts(req: Request, res: Response) {
		const counts = await contentPagesService.countsLegal(req.user!.id);
		return ApiResponse.success(res, counts);
	}

	async getLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");
		const page = await contentPagesService.getById(id);
		if (!page) return ApiResponse.notFound(res, "Legal page not found");
		return ApiResponse.success(res, serializeContentPage(page));
	}

	async updateLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");
		const data = updateSchema.parse(req.body);
		const updated = await contentPagesService.updateById(id, {
			title: data.title,
			contentBlocks: data.contentBlocks === undefined ? undefined : data.contentBlocks,
			metaDescription: data.metaDescription ?? undefined,
			metaKeywords: data.metaKeywords ?? undefined,
			previewImageId: data.previewImageId ?? undefined,
			status: data.status as Status | undefined,
		});
		if (!updated) return ApiResponse.notFound(res, "Legal page not found");

		ActivityService.log({
			userId: req.user!.id,
			action: "update",
			module: "content",
			itemType: "page",
			itemId: updated.id,
			itemTitle: updated.title,
			description: `**${updated.title}** page has been updated`,
		});
		return ApiResponse.success(res, serializeContentPage(updated));
	}

	async deleteLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");
		// Fetch for logging
		const existing = await contentPagesService.getById(id);
		if (!existing) return ApiResponse.notFound(res, "Legal page not found");
		const ok = await contentPagesService.deleteById(id);
		if (!ok) return ApiResponse.internalError(res, "Failed to delete legal page");

		ActivityService.log({
			userId: req.user!.id,
			action: "delete",
			module: "content",
			itemType: "page",
			itemId: id,
			itemTitle: existing.title,
			description: `**${existing.title}** page has been deleted`,
		});

		return ApiResponse.success(res, { message: "Legal page deleted" });
	}

	async restoreLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");
		// Fetch for logging (include trashed)
		const existing = await contentPagesService.getById(id);
		if (!existing) return ApiResponse.notFound(res, "Legal page not found");
		const ok = await contentPagesService.restoreById(id);
		if (!ok) return ApiResponse.internalError(res, "Failed to restore legal page");

		ActivityService.log({
			userId: req.user!.id,
			action: "restore",
			module: "content",
			itemType: "page",
			itemId: id,
			itemTitle: existing.title,
			description: `**${existing.title}** page has been restored`,
		});

		return ApiResponse.success(res, { message: "Legal page restored" });
	}

	async purgeLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");
		// Fetch for logging
		const existing = await contentPagesService.getById(id);
		if (!existing) return ApiResponse.notFound(res, "Legal page not found");
		const ok = await contentPagesService.purgeById(id);
		if (!ok) return ApiResponse.internalError(res, "Failed to purge legal page");

		ActivityService.log({
			userId: req.user!.id,
			action: "permanentlyDelete",
			module: "content",
			itemType: "page",
			itemId: id,
			itemTitle: existing.title,
			description: `**${existing.title}** page has been permanently deleted`,
		});

		return ApiResponse.success(res, {
			message: "Legal page permanently deleted",
		});
	}

	async publishLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");

		const existing = await contentPagesService.getById(id);
		if (!existing) return ApiResponse.notFound(res, "Legal page not found");

		if (existing.status === Status.PUBLISHED) {
			return ApiResponse.success(res, serializeContentPage(existing));
		}

		const updated = await contentPagesService.updateById(id, {
			status: Status.PUBLISHED,
		});

		if (!updated) return ApiResponse.notFound(res, "Legal page not found");

		ActivityService.log({
			userId: req.user!.id,
			action: "publish",
			module: "content",
			itemType: "page",
			itemId: updated.id,
			itemTitle: updated.title,
			description: `**${updated.title}** page has been published`,
		});
		return ApiResponse.success(res, serializeContentPage(updated));
	}

	async unpublishLegalById(req: Request, res: Response) {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) return ApiResponse.badRequest(res, "Invalid id");

		const existing = await contentPagesService.getById(id);
		if (!existing) return ApiResponse.notFound(res, "Legal page not found");

		if (existing.status === Status.DRAFT) {
			return ApiResponse.success(res, serializeContentPage(existing));
		}

		const updated = await contentPagesService.updateById(id, {
			status: Status.DRAFT,
		});

		if (!updated) return ApiResponse.notFound(res, "Legal page not found");

		ActivityService.log({
			userId: req.user!.id,
			action: "unpublish",
			module: "content",
			itemType: "page",
			itemId: updated.id,
			itemTitle: updated.title,
			description: `**${updated.title}** page has been unpublished`,
		});
		return ApiResponse.success(res, serializeContentPage(updated));
	}

	async bulkPublishLegal(req: Request, res: Response) {
		const { ids } = req.body;
		if (!Array.isArray(ids) || ids.length === 0) {
			return ApiResponse.badRequest(res, "Invalid ids");
		}
		const pages = await contentPagesService.bulkPublish(ids);

		ActivityService.logMany(
			pages.map((page) => ({
				userId: req.user!.id,
				action: "publish",
				module: "content",
				itemType: "page",
				itemId: page.id,
				itemTitle: page.title,
				description: `**${page.title}** page has been published`,
			})),
		);

		return ApiResponse.success(res, { message: "Pages published" });
	}

	async bulkUnpublishLegal(req: Request, res: Response) {
		const { ids } = req.body;
		if (!Array.isArray(ids) || ids.length === 0) {
			return ApiResponse.badRequest(res, "Invalid ids");
		}
		const pages = await contentPagesService.bulkUnpublish(ids);

		ActivityService.logMany(
			pages.map((page) => ({
				userId: req.user!.id,
				action: "unpublish",
				module: "content",
				itemType: "page",
				itemId: page.id,
				itemTitle: page.title,
				description: `**${page.title}** page has been unpublished`,
			})),
		);

		return ApiResponse.success(res, { message: "Pages unpublished" });
	}

	async bulkDeleteLegal(req: Request, res: Response) {
		const { ids } = req.body;
		if (!Array.isArray(ids) || ids.length === 0) {
			return ApiResponse.badRequest(res, "Invalid ids");
		}
		const pages = await contentPagesService.bulkDelete(ids);

		ActivityService.logMany(
			pages.map((page) => ({
				userId: req.user!.id,
				action: "delete",
				module: "content",
				itemType: "page",
				itemId: page.id,
				itemTitle: page.title,
				description: `**${page.title}** page has been deleted`,
			})),
		);

		return ApiResponse.success(res, { message: "Pages deleted" });
	}

	async bulkRestoreLegal(req: Request, res: Response) {
		const { ids } = req.body;
		if (!Array.isArray(ids) || ids.length === 0) {
			return ApiResponse.badRequest(res, "Invalid ids");
		}
		const pages = await contentPagesService.bulkRestore(ids);

		ActivityService.logMany(
			pages.map((page) => ({
				userId: req.user!.id,
				action: "restore",
				module: "content",
				itemType: "page",
				itemId: page.id,
				itemTitle: page.title,
				description: `**${page.title}** page has been restored`,
			})),
		);

		return ApiResponse.success(res, { message: "Pages restored" });
	}

	async bulkPurgeLegal(req: Request, res: Response) {
		const { ids } = req.body;
		if (!Array.isArray(ids) || ids.length === 0) {
			return ApiResponse.badRequest(res, "Invalid ids");
		}
		const pages = await contentPagesService.bulkPurge(ids);

		ActivityService.logMany(
			pages.map((page) => ({
				userId: req.user!.id,
				action: "permanentlyDelete",
				module: "content",
				itemType: "page",
				itemId: page.id,
				itemTitle: page.title,
				description: `**${page.title}** page has been permanently deleted`,
			})),
		);

		return ApiResponse.success(res, { message: "Pages permanently deleted" });
	}
}

export const contentPagesController = new ContentPagesController();
