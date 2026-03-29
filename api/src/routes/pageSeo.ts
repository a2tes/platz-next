import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { pageSeoService, VALID_PAGE_KEYS } from "../services/pageSeoService";
import { asyncHandler, createApiError } from "../middleware/errorHandler";
import { z } from "zod";

const router = Router();
router.use(authenticateToken);

// GET /api/page-seo — list all page SEO records
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		const records = await pageSeoService.getAll();
		res.json({ success: true, data: records });
	}),
);

// GET /api/page-seo/:pageKey — get SEO for a specific page
router.get(
	"/:pageKey",
	asyncHandler(async (req: Request, res: Response) => {
		const pageKey = req.params.pageKey as string;
		if (!VALID_PAGE_KEYS.includes(pageKey as any)) {
			throw createApiError.badRequest(`Invalid page key: ${pageKey}`);
		}
		const record = await pageSeoService.getByPageKey(pageKey);
		res.json({ success: true, data: record });
	}),
);

const upsertSchema = z.object({
	title: z.string().nullable().optional(),
	metaDescription: z.string().nullable().optional(),
	metaKeywords: z.string().nullable().optional(),
	ogImageId: z.number().nullable().optional(),
});

// PUT /api/page-seo/:pageKey — upsert SEO for a specific page
router.put(
	"/:pageKey",
	asyncHandler(async (req: Request, res: Response) => {
		const pageKey = req.params.pageKey as string;
		if (!VALID_PAGE_KEYS.includes(pageKey as any)) {
			throw createApiError.badRequest(`Invalid page key: ${pageKey}`);
		}
		const data = upsertSchema.parse(req.body);
		const record = await pageSeoService.upsert(pageKey, data);
		res.json({ success: true, data: record });
	}),
);

export default router;
