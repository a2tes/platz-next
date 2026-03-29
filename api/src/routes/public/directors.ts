import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler, createApiError } from "../../middleware/errorHandler";
import { serializeMediaFile, buildCroppedUrl } from "../../utils/serialization";
import { blockPageService } from "../../services/blockService";
import { VIDEO_PROCESSING_CONFIG } from "../../config/videoProcessing";

const router = Router();

// GET /api/public/directors
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		// Remove pagination: always return all published directors with a top work snippet
		const search = typeof req.query.search === "string" ? req.query.search : "";

		const where: any = {
			status: "PUBLISHED",
			purgedAt: null,
			deletedAt: null,
			works: {
				some: {
					work: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
				},
			},
		};
		if (search) {
			where.OR = [{ title: { contains: search, mode: "insensitive" } }];
		}

		const directors = await prisma.director.findMany({
			where,
			orderBy: [{ title: "asc" }],
			select: {
				id: true,
				title: true,
				slug: true,
				// Fetch only the top (lowest sortOrder) published work relation
				works: {
					where: {
						work: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
					},
					orderBy: { sortOrder: "asc" } as any,
					take: 1,
					select: {
						work: {
							select: {
								slug: true,
								title: true,
								videoFile: true,
							},
						},
					},
				},
			},
		});

		const items = directors.map((d) => {
			const wd: any = (d as any).works?.[0];
			const work = wd?.work;
			const videoFile = work?.videoFile ? serializeMediaFile(work.videoFile) : null;
			return {
				slug: d.slug,
				title: d.title,
				work: work ? { title: work.title, slug: work.slug } : null,
				// Use 720p MP4 for fast background loading (same as homepage)
				videoUrl: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || videoFile?.video?.default || null,
				videoUrl720p: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || null,
				hlsUrl: videoFile?.video?.hls || null,
				optimizedVideoUrl: videoFile?.video?.mp4 || null,
				previewVideoUrl: videoFile?.video?.preview || null,
			};
		});

		res.set("Cache-Control", "public, max-age=120, s-maxage=600");
		res.json(items);
	}),
);

// GET /api/public/directors/:slug
router.get(
	"/:slug",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		const d = await prisma.director.findFirst({
			where: {
				slug,
				status: { in: ["PUBLISHED", "UNLISTED"] },
				purgedAt: null,
				deletedAt: null,
			},
			select: {
				id: true,
				title: true,
				slug: true,
				shortDescription: true,
				biography: true,
				links: true,
				metaDescription: true,
				metaKeywords: true,
				avatar: true,
				ogImage: true,
				heroMediaId: true,
				heroMedia: true,
				heroVideo: true,
				heroWorkId: true,
				heroWork: {
					select: {
						id: true,
						slug: true,
						title: true,
						shortDescription: true,
						client: true,
						videoFile: true,
					},
				},
				works: {
					where: {
						work: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
					},
					orderBy: { sortOrder: "asc" },
					select: {
						work: {
							select: {
								slug: true,
								title: true,
								shortDescription: true,
								client: true,
								videoFile: true,
							},
						},
					},
				},
			},
		});
		if (!d) throw createApiError.notFound("Director not found");

		// Serialize the response to handle media files and clean up structure
		const director = d as any;
		const avatarFile = director.avatar ? serializeMediaFile(director.avatar) : null;

		// Build Preview Image URL from mediable crop data
		let ogImageUrl: string | null = null;
		if (director.ogImage) {
			const mediable = await prisma.mediable.findUnique({
				where: {
					subjectType_subjectId_usageKey: {
						subjectType: "Director",
						subjectId: director.id,
						usageKey: "ogImage",
					},
				},
			});
			ogImageUrl = buildCroppedUrl(director.ogImage, mediable, { w: 1200, h: 630 });
		}

		// Build hero video data
		let heroVideo: any = null;
		if (director.heroVideo) {
			const hv = director.heroVideo as any;
			const heroMediaFile = director.heroMedia ? serializeMediaFile(director.heroMedia) : null;
			heroVideo = {
				// Original video URLs from the source media file
				videoUrl: heroMediaFile?.video?.mp4_720p || heroMediaFile?.video?.mp4 || heroMediaFile?.video?.default || null,
				videoUrl720p: heroMediaFile?.video?.mp4_720p || heroMediaFile?.video?.mp4 || null,
				hlsUrl: heroMediaFile?.video?.hls || null,
				// Processed clip URLs (cropped/trimmed)
				clipUrl: hv.processedVideo?.url || null,
				clipThumbnailUrl: hv.processedVideo?.thumbnailUrl || null,
				clipStatus: hv.processedVideo?.status || null,
			};
		}

		// Build hero work data (the selected work for the hero section)
		let heroWork: any = null;
		if (director.heroWork) {
			const hw = director.heroWork;
			const hwVideoFile = hw.videoFile ? serializeMediaFile(hw.videoFile) : null;
			heroWork = {
				slug: hw.slug,
				title: hw.title,
				shortDescription: hw.shortDescription,
				client: hw.client,
				videoUrl: hwVideoFile?.video?.mp4_720p || hwVideoFile?.video?.mp4 || hwVideoFile?.video?.default || null,
				videoUrl720p: hwVideoFile?.video?.mp4_720p || hwVideoFile?.video?.mp4 || null,
				previewVideoUrl: hwVideoFile?.video?.preview || hwVideoFile?.video?.mp4_720p || null,
				hlsUrl: hwVideoFile?.video?.hls || null,
				optimizedVideoUrl: hwVideoFile?.video?.mp4 || null,
				images: hwVideoFile?.images || null,
			};
		}

		const serialized = {
			title: director.title,
			slug: director.slug,
			shortDescription: director.shortDescription,
			biography: director.biography,
			links: director.links || [],
			metaDescription: director.metaDescription || null,
			metaKeywords: director.metaKeywords || null,
			ogImageUrl,
			heroVideo,
			heroWork,
			avatar: avatarFile?.images || null,
			works: director.works.map((w: any) => {
				const videoFile = w.work.videoFile ? serializeMediaFile(w.work.videoFile) : null;
				return {
					work: {
						slug: w.work.slug,
						title: w.work.title,
						shortDescription: w.work.shortDescription,
						client: w.work.client,

						// Use 720p MP4 for hero/background videos (fast loading)
						videoUrl: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || videoFile?.video?.default || null,
						// 720p for explicit use
						videoUrl720p: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || null,
						// 480p for hover previews (even faster)
						previewVideoUrl: videoFile?.video?.preview || videoFile?.video?.mp4_720p || null,
						// HLS for modal playback
						hlsUrl: videoFile?.video?.hls || null,
						optimizedVideoUrl: videoFile?.video?.mp4 || null,
						images: videoFile?.images || null,
					},
				};
			}),
		};

		res.set("Cache-Control", "public, max-age=600, s-maxage=1800");
		res.json(serialized);
	}),
);

// GET /api/public/directors/:slug/blocks
router.get(
	"/:slug/blocks",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		const page = Math.max(1, Number(req.query.page ?? 1));
		const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 5)));

		// Find the director
		const director = await prisma.director.findFirst({
			where: {
				slug,
				status: { in: ["PUBLISHED", "UNLISTED"] },
				purgedAt: null,
				deletedAt: null,
			},
			select: { id: true },
		});
		if (!director) throw createApiError.notFound("Director not found");

		// Fetch blocks using the generic block service
		const skip = (page - 1) * limit;
		const [blocks, total] = await Promise.all([
			prisma.block.findMany({
				where: {
					modelName: "Director",
					modelId: director.id,
					parentId: null,
				},
				orderBy: { position: "asc" },
				skip,
				take: limit,
				include: {
					children: {
						orderBy: { position: "asc" },
					},
				},
			}),
			prisma.block.count({
				where: {
					modelName: "Director",
					modelId: director.id,
					parentId: null,
				},
			}),
		]);

		// Sort by position and enrich with work details
		const sortedBlocks = blocks.sort((a, b) => a.position - b.position);
		const enrichedBlocks = await blockPageService.enrichBlocksWithWorkDetails(sortedBlocks);

		res.set("Cache-Control", "public, max-age=60, s-maxage=300");
		res.json({
			data: enrichedBlocks,
			meta: {
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	}),
);

export default router;
