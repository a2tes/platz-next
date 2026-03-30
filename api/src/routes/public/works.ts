import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { serializeMediaFile } from "../../utils/serialization";
import { asyncHandler, createApiError } from "../../middleware/errorHandler";
import { getPublicPageBlocks } from "../../controllers/blockController";

const router = Router();

// GET /api/public/works - Block-based works list with pagination
// Delegates to the shared getPublicPageBlocks controller with type=WORKS
router.get("/", (req: Request, res: Response, next) => {
	(req.params as any).type = "WORKS";
	getPublicPageBlocks(req, res, next);
});

// GET /api/public/works/:slug
router.get(
	"/:slug",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		const work = await prisma.work.findFirst({
			where: {
				slug,
				status: "PUBLISHED" as any,
				purgedAt: null,
				deletedAt: null,
			},
			include: {
				videoFile: true,
			},
		});

		if (!work) {
			throw createApiError.notFound("Work not found");
		}

		res.set("Cache-Control", "public, max-age=120, s-maxage=600");
		const serializedVideoFile = (work as any).videoFile ? serializeMediaFile((work as any).videoFile) : null;

		// Minimal response - only fields used by client
		const data = {
			title: work.title,
			slug: work.slug,
			shortDescription: (work as any).shortDescription || "",
			client: (work as any).client || "",
			metaDescription: (work as any).metaDescription || null,
			metaKeywords: (work as any).metaKeywords || null,
			// Video URLs with fallback chain
			videoUrl:
				serializedVideoFile?.video?.mp4_720p ||
				serializedVideoFile?.video?.mp4 ||
				serializedVideoFile?.video?.default ||
				null,
			videoUrl720p: serializedVideoFile?.video?.mp4_720p || serializedVideoFile?.video?.mp4 || null,
			hlsUrl: serializedVideoFile?.video?.hls || null,
			optimizedVideoUrl: serializedVideoFile?.video?.mp4 || null,
			previewVideoUrl: serializedVideoFile?.video?.preview || serializedVideoFile?.video?.mp4_720p || null,
			videoThumbnailUrl: serializedVideoFile?.images?.thumbnail || null,
		};

		res.json({ success: true, data });
	}),
);

export default router;
