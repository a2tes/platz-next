import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler } from "../../middleware/errorHandler";
import { serializeMediaFile } from "../../utils/serialization";
import { VIDEO_PROCESSING_CONFIG } from "../../config/videoProcessing";

function toCloudFrontUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const domain = VIDEO_PROCESSING_CONFIG.cloudfront?.domain;
	if (!domain) return path;
	return `https://${domain}/${path}`;
}

const router = Router();

// GET /api/public/homepage/directors
router.get(
	"/directors",
	asyncHandler(async (req: Request, res: Response) => {
		const rows = await prisma.homepageDirector.findMany({
			where: {
				director: {
					status: { in: ["PUBLISHED", "UNLISTED"] as any },
					purgedAt: null,
					deletedAt: null,
				},
				work: {
					status: "PUBLISHED" as any,
					purgedAt: null,
					deletedAt: null,
				},
			},
			orderBy: { sortOrder: "asc" },
			include: {
				director: { select: { id: true, title: true, slug: true } },
				work: {
					select: {
						title: true,
						slug: true,
						videoFile: true,
						videoFileId: true,
					},
				},
				clipJob: {
					select: {
						id: true,
						status: true,
						outputPath: true,
						outputMetadata: true,
					},
				},
			},
		});

		// Rows are already sorted by sortOrder (flat ordering)

		// Collect videoFileIds for rows that need default clip lookup
		const defaultClipNeeded = rows
			.filter((row) => row.videoSource === "default_clip" && (row as any).work?.videoFileId)
			.map((row) => (row as any).work.videoFileId as number);

		// Batch fetch default clips for all needed media files
		const defaultClips =
			defaultClipNeeded.length > 0
				? await prisma.clipJob.findMany({
						where: {
							sourceMediaId: { in: defaultClipNeeded },
							isDefault: true,
							status: "COMPLETED",
						},
						select: {
							sourceMediaId: true,
							outputPath: true,
							outputMetadata: true,
						},
					})
				: [];
		const defaultClipMap = new Map(defaultClips.map((c) => [c.sourceMediaId, c]));

		const items = rows.map((row) => {
			const wf: any = (row as any).work;
			const videoFile = wf?.videoFile ? serializeMediaFile(wf.videoFile) : null;

			// Resolve video URL based on videoSource
			let videoUrl = videoFile?.video?.default || null;
			let videoUrl720p = videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || null;

			if (row.videoSource === "clip" && row.clipJob?.status === "COMPLETED" && row.clipJob?.outputPath) {
				const clipUrl = toCloudFrontUrl(row.clipJob.outputPath);
				videoUrl = clipUrl;
				videoUrl720p = clipUrl;
			} else if (row.videoSource === "default_clip" && wf?.videoFileId) {
				const dc = defaultClipMap.get(wf.videoFileId);
				if (dc?.outputPath) {
					const dcUrl = toCloudFrontUrl(dc.outputPath);
					videoUrl = dcUrl;
					videoUrl720p = dcUrl;
				}
				// fallback to original if no default clip
			}
			// "original" or fallback: use videoFile URLs (already set above)

			return {
				sortOrder: row.sortOrder,
				director: { title: row.director.title, slug: row.director.slug },
				work: wf ? { title: wf.title, slug: wf.slug } : null,
				images: videoFile?.images || null,
				videoUrl,
				videoUrl720p,
			};
		});

		res.set("Cache-Control", "public, max-age=60, s-maxage=300");
		res.json({ items });
	}),
);

export default router;
