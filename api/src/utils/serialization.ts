/**
 * Utility functions for handling serialization issues
 */

import { storageService } from "../services/storageService";
import { imageService } from "../services/image";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";

/**
 * Convert a path to CloudFront URL
 */
function toCloudFrontUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	// If it's already a full URL, return as is (backward compatibility)
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}
	const domain = VIDEO_PROCESSING_CONFIG.cloudfront.domain;
	return `https://${domain}/${path}`;
}

/**
 * Safely serialize a date-like value to ISO string.
 * Accepts Date, string, number, or other objects. Falls back to original value on failure.
 */
function serializeDate(value: any): any {
	if (value == null) return value;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "number") {
		const d = new Date(value);
		return isNaN(d.getTime()) ? value : d.toISOString();
	}
	if (typeof value === "string") {
		// If it's already an ISO string, keep it; otherwise try to parse.
		const d = new Date(value);
		return isNaN(d.getTime()) ? value : d.toISOString();
	}
	// Handle objects that expose toISOString without being Date instances
	const toIso = (value as any)?.toISOString;
	if (typeof toIso === "function") {
		try {
			return toIso.call(value);
		} catch {
			// ignore and fall through
		}
	}
	return value;
}

/**
 * Convert BigInt values to strings for JSON serialization
 * Also preserves Date objects properly
 */
export function serializeBigInt(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === "bigint") {
		return obj.toString();
	}

	// Preserve Date objects - they will be serialized to ISO string by JSON.stringify
	if (obj instanceof Date) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(serializeBigInt);
	}

	if (typeof obj === "object") {
		const serialized: any = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				serialized[key] = serializeBigInt(obj[key]);
			}
		}
		return serialized;
	}

	return obj;
}

/**
 * Serialize MediaFile objects to handle BigInt size field and add URLs
 */
export function serializeMediaFile(mediaFile: any) {
	if (!mediaFile) return mediaFile;

	// Check if video is processed and optimized versions are available
	const isVideoProcessed =
		mediaFile.processingStatus === "completed" &&
		mediaFile.optimizedUrls &&
		typeof mediaFile.optimizedUrls === "object";

	const is480pAvailable = isVideoProcessed && mediaFile.optimizedUrls["480p"];

	// For video files with 480p available, use that for thumbnail generation
	// This is needed because ImageKit has 100MB file size limit
	let thumbnailSourceKey = mediaFile.uuid;

	// If 480p is available, use that path for ImageKit thumbnails
	// Now paths are stored without domain, e.g.: optimized/uuid/mp4/filename_480p.mp4
	if (is480pAvailable && mediaFile.optimizedUrls["480p"]) {
		thumbnailSourceKey = mediaFile.optimizedUrls["480p"];
	}

	// Generate URLs from uuid using configured endpoint type (local or S3)
	const urlSet = mediaFile.uuid
		? storageService.generateUrlSet(thumbnailSourceKey, mediaFile.mimeType, mediaFile.thumbnailTime)
		: null;

	// For processed videos, override video.default with optimized version
	// Priority: HLS > 1080p MP4 > original
	// Convert paths to full CloudFront URLs
	let videoUrls = urlSet?.video;
	if (videoUrls && isVideoProcessed) {
		const hlsUrl = toCloudFrontUrl(mediaFile.hlsUrl);
		const mp4Url = toCloudFrontUrl(mediaFile.optimizedUrls["1080p"]) || toCloudFrontUrl(mediaFile.optimizedVideoUrl);
		const mp4720Url = toCloudFrontUrl(mediaFile.optimizedUrls["720p"]);
		const mp4480Url = toCloudFrontUrl(mediaFile.optimizedUrls["480p"]);

		videoUrls = {
			...videoUrls,
			// Use HLS as default if available, otherwise optimized 1080p
			default: hlsUrl || mp4Url || videoUrls.default,
			// Add HLS URL explicitly
			hls: hlsUrl,
			// Add optimized MP4 for fallback (1080p)
			mp4: mp4Url,
			// Add 720p MP4
			mp4_720p: mp4720Url,
			// Add 480p for fast preview (hover)
			preview: mp4480Url,
			// Keep original for fallback
			original: videoUrls.default,
		};
	}

	// If video has a custom thumbnail (generated from canvas), use it for images
	// This replaces the provider-based video thumbnail with our self-hosted one
	let images = urlSet?.images ?? {
		original: "",
		thumbnail: "",
		small: "",
		medium: "",
		large: "",
	};

	// For video files, handle thumbnail differently
	if (mediaFile.mimeType?.startsWith("video/")) {
		if (mediaFile.thumbnailPath) {
			// Use custom uploaded thumbnail
			const thumbnailUrlSet = storageService.generateUrlSet(mediaFile.thumbnailPath, "image/jpeg");
			images = thumbnailUrlSet.images;
		} else {
			// No custom thumbnail - return empty strings to trigger placeholder in frontend
			// Don't use ImageKit video thumbnails due to rate limits
			images = {
				original: "",
				thumbnail: "",
				small: "",
				medium: "",
				large: "",
			};
		}
	}

	return {
		...mediaFile,
		size: mediaFile.size ? mediaFile.size.toString() : mediaFile.size,
		images,
		video: videoUrls,
		// Video processing fields
		processingStatus: mediaFile.processingStatus,
		processingError: mediaFile.processingError,
		hlsUrl: mediaFile.hlsUrl,
		optimizedVideoUrl: mediaFile.optimizedVideoUrl,
		optimizedUrls: mediaFile.optimizedUrls,
		thumbnailPath: mediaFile.thumbnailPath,
	};
}

/**
 * Serialize Work objects with all nested MediaFile objects
 */
export function serializeWork(work: any) {
	if (!work) return work;

	return {
		...work,
		videoFile: serializeMediaFile(work.videoFile),
		previewImage: serializeMediaFile(work.previewImage),
		revisions: work.revisions?.map((revision: any) => ({
			id: revision.id,
			version: revision.version,
			createdAt: serializeDate(revision.createdAt),
			userId: revision.userId,
			workId: revision.workId,
			user: revision.user?.name,
			revertedFromId: revision.revertedFromId,
			payload: typeof revision.payload === "string" ? JSON.parse(revision.payload) : revision.payload,
		})),
		directors: work.directors?.map((wd: any) => ({
			...wd,
			director: {
				...wd.director,
				avatar: serializeMediaFile(wd.director?.avatar),
			},
		})),
		starrings: work.starrings?.map((ws: any) => ({
			...ws,
			starring: {
				...ws.starring,
				avatar: serializeMediaFile(ws.starring?.avatar),
			},
		})),
	};
}

/**
 * Serialize ContentPage with nested media
 */
export function serializeContentPage(page: any) {
	if (!page) return page;
	return {
		...page,
		previewImage: serializeMediaFile(page.previewImage),
	};
}

/**
 * Build a cropped image URL using the configured image provider with mediable crop data
 */
export function buildCroppedUrl(
	mediaFile: any,
	mediable: any,
	options?: { w?: number; h?: number; q?: number }
): string | null {
	if (!mediaFile?.uuid) return null;

	// If no crop data, just generate a regular URL with options
	if (!mediable || mediable.cropX == null) {
		return imageService.generateUrl(mediaFile.uuid, {
			width: options?.w,
			height: options?.h,
			quality: options?.q,
			format: "auto",
		});
	}

	// Apply crop rectangle with mediable data
	const rect = {
		x: mediable.cropX,
		y: mediable.cropY,
		w: mediable.cropW,
		h: mediable.cropH,
	};

	return imageService.generateCroppedUrl(mediaFile.uuid, rect, {
		width: options?.w,
		height: options?.h,
		quality: options?.q,
		format: "auto",
	});
}

/**
 * Serialize MediaFile with crop URLs from mediable data
 */
export function serializeMediaFileWithCrop(mediaFile: any, mediable: any): any {
	if (!mediaFile) return null;

	const base = serializeMediaFile(mediaFile);

	// Add cropped URLs if mediable has crop data
	if (mediable && mediable.cropX != null) {
		base.images.cropped = {
			thumbnail: buildCroppedUrl(mediaFile, mediable, {
				w: 150,
				h: 150,
				q: 75,
			}),
			small: buildCroppedUrl(mediaFile, mediable, { w: 300, q: 80 }),
			medium: buildCroppedUrl(mediaFile, mediable, { w: 600, q: 85 }),
			large: buildCroppedUrl(mediaFile, mediable, { w: 1200, q: 90 }),
			hero: buildCroppedUrl(mediaFile, mediable, { w: 1920, q: 90 }),
		};
	}

	return base;
}

/**
 * Serialize Animation objects with all nested MediaFile objects
 */
export function serializeAnimation(animation: any) {
	if (!animation) return animation;

	return {
		...animation,
		videoFile: serializeMediaFile(animation.videoFile),
		previewImage: serializeMediaFile(animation.previewImage),
		revisions: animation.revisions?.map((revision: any) => ({
			id: revision.id,
			version: revision.version,
			createdAt: serializeDate(revision.createdAt),
			userId: revision.userId,
			animationId: revision.animationId,
			user: revision.user?.name,
			revertedFromId: revision.revertedFromId,
			payload: typeof revision.payload === "string" ? JSON.parse(revision.payload) : revision.payload,
		})),
	};
}
