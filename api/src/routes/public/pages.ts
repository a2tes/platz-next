import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { serializeMediaFile } from "../../utils/serialization";
import { asyncHandler, createApiError } from "../../middleware/errorHandler";

const router = Router();

// GET /api/public/pages/legal - Get all published legal pages
router.get(
	"/legal",
	asyncHandler(async (req: Request, res: Response) => {
		const pages = await prisma.contentPage.findMany({
			where: {
				type: "LEGAL",
				status: "PUBLISHED",
				deletedAt: null,
			},
			select: {
				id: true,
				slug: true,
				title: true,
			},
			orderBy: { title: "asc" },
		});

		res.set("Cache-Control", "public, max-age=300, s-maxage=900");
		res.json(pages);
	}),
);

// GET /api/public/pages/:slug
router.get(
	"/:slug",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		// If slug is 'about' or 'contact', look up by type. Otherwise look up by slug.
		const where: any = {
			status: "PUBLISHED",
			deletedAt: null,
		};

		if (slug === "about") {
			where.type = "ABOUT";
		} else if (slug === "contact") {
			where.type = "CONTACT";
		} else {
			where.slug = slug;
		}

		const page = await prisma.contentPage.findFirst({
			where,
			include: {
				previewImage: true,
			},
		});

		if (!page) {
			throw createApiError.notFound("Page not found");
		}

		res.set("Cache-Control", "public, max-age=300, s-maxage=900");
		const contentBlocks = (page as any).contentBlocks;
		// Support both Quill format (has "format": "quill") and legacy EditorJS format (has "blocks" array)
		const formattedContentBlocks = contentBlocks?.format === "quill" ? contentBlocks : contentBlocks?.blocks || [];

		const data = page
			? {
					type: page.type,
					slug: page.slug,
					title: page.title,
					contentBlocks: formattedContentBlocks,
					mapEmbed: (page as any).mapEmbed,
					metaDescription: (page as any).metaDescription,
					metaKeywords: (page as any).metaKeywords,
					previewImage: serializeMediaFile((page as any).previewImage),
				}
			: null;
		res.json(data);
	}),
);

export default router;
