import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { serializeMediaFile } from "../../utils/serialization";
import { asyncHandler, createApiError } from "../../middleware/errorHandler";
import { getPublicPageBlocks } from "../../controllers/blockController";

const router = Router();

// GET /api/public/animations - Block-based animations list with pagination
// Delegates to the shared getPublicPageBlocks controller with type=ANIMATIONS
router.get("/", (req: Request, res: Response, next) => {
	(req.params as any).type = "ANIMATIONS";
	getPublicPageBlocks(req, res, next);
});

// GET /api/public/animations/:slug
router.get(
	"/:slug",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		const animation = await prisma.animation.findFirst({
			where: {
				slug,
				status: "PUBLISHED" as any,
				purgedAt: null,
				deletedAt: null,
			},
			include: {
				previewImage: true,
				videoFile: true,
			},
		});

		if (!animation) {
			throw createApiError.notFound("Animation not found");
		}

		res.set("Cache-Control", "public, max-age=120, s-maxage=600");
		const serializedVideoFile = (animation as any).videoFile ? serializeMediaFile((animation as any).videoFile) : null;
		const data = animation
			? {
					id: animation.id,
					title: animation.title,
					slug: animation.slug,
					shortDescription: (animation as any).shortDescription,
					client: (animation as any).client,
					metaDescription: (animation as any).metaDescription || null,
					metaKeywords: (animation as any).metaKeywords || null,
					tags: (animation as any).tags,
					createdAt: (animation as any).createdAt,
					publishedAt: (animation as any).publishedAt,
					previewImageId: (animation as any).previewImageId,
					videoFileId: (animation as any).videoFileId,
					previewImage: serializeMediaFile((animation as any).previewImage),
					videoFile: serializedVideoFile,
					videoUrl: serializedVideoFile?.video?.default || null,
					hlsUrl: serializedVideoFile?.video?.hls || null,
					optimizedVideoUrl: serializedVideoFile?.video?.mp4 || null,
					previewVideoUrl: serializedVideoFile?.video?.preview || null,
				}
			: null;
		res.json({ success: true, data });
	}),
);

export default router;
