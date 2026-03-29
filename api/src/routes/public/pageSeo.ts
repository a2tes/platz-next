import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler } from "../../middleware/errorHandler";
import { buildCroppedUrl } from "../../utils/serialization";

const router = Router();

// GET /api/public/page-seo/:pageKey — get SEO for a specific page (public, cached)
router.get(
	"/:pageKey",
	asyncHandler(async (req: Request, res: Response) => {
		const pageKey = req.params.pageKey as string;
		const record = await prisma.pageSeo.findUnique({
			where: { pageKey },
			include: { ogImage: true },
		});

		let ogImageUrl: string | null = null;
		if (record?.ogImageId && record.ogImage) {
			// Look up crop data from mediable
			const mediable = await prisma.mediable.findUnique({
				where: {
					subjectType_subjectId_usageKey: {
						subjectType: "PageSeo",
						subjectId: record.id,
						usageKey: "ogImage",
					},
				},
			});
			ogImageUrl = buildCroppedUrl(record.ogImage, mediable, { w: 1200, h: 630 });
		}

		// Cache for 10 minutes on CDN, 2 minutes in browser
		res.set("Cache-Control", "public, max-age=120, s-maxage=600");
		res.json({
			success: true,
			data: record
				? {
						title: record.title,
						metaDescription: record.metaDescription,
						metaKeywords: record.metaKeywords,
						ogImageUrl,
					}
				: null,
		});
	}),
);

export default router;
