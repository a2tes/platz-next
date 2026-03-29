"use client";

/**
 * Universal Image Loader for Next.js
 * Supports both Imgix and ImageKit based on URL detection
 */

type ImageLoaderProps = {
	src: string;
	width: number;
	quality?: number;
};

/**
 * Detect which image provider the URL belongs to
 */
function detectProvider(url: string): "imgix" | "imagekit" | "unknown" {
	if (url.includes("imgix.net") || url.includes(process.env.NEXT_PUBLIC_IMGIX_URL || "")) {
		return "imgix";
	}
	if (url.includes("imagekit.io") || url.includes(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "")) {
		return "imagekit";
	}
	return "unknown";
}

/**
 * Apply Imgix transformations
 */
function applyImgixParams(url: URL, width: number, quality?: number): string {
	const params = url.searchParams;
	params.set("auto", params.get("auto") || "format,compress");
	params.set("fit", params.get("fit") || "max");
	params.set("w", params.get("w") || width.toString());
	if (quality) {
		params.set("q", quality.toString());
	}
	return url.href;
}

/**
 * Apply ImageKit transformations
 * ImageKit uses tr= parameter with comma-separated transformations
 */
function applyImageKitParams(url: URL, width: number, quality?: number): string {
	const existingTr = url.searchParams.get("tr") || "";
	const transforms: string[] = existingTr ? existingTr.split(",") : [];

	// Check if width is already set
	const hasWidth = transforms.some((t) => t.startsWith("w-"));
	if (!hasWidth) {
		transforms.push(`w-${width}`);
	}

	// Add quality if specified
	if (quality) {
		const hasQuality = transforms.some((t) => t.startsWith("q-"));
		if (!hasQuality) {
			transforms.push(`q-${quality}`);
		}
	}

	url.searchParams.set("tr", transforms.join(","));
	return url.href;
}

/**
 * Next.js Image Loader
 * Automatically detects and applies the correct transformations for Imgix or ImageKit
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
	// Ensure src is a string
	if (!src) return "";

	try {
		const url = new URL(src);
		const provider = detectProvider(src);

		switch (provider) {
			case "imgix":
				return applyImgixParams(url, width, quality);
			case "imagekit":
				return applyImageKitParams(url, width, quality);
			default:
				// For unknown providers, just return the URL as-is
				// You might want to add width as a query param for generic CDNs
				return src;
		}
	} catch (e) {
		// If src is not a valid URL (e.g. relative path), return it as is
		return src;
	}
}

// Also export as imgixLoader for backward compatibility
export { imageLoader as imgixLoader };

/**
 * Video Thumbnail Loader
 * Generates video thumbnail URLs for both Imgix and ImageKit
 * Each provider has different URL formats for video thumbnails
 */
export function videoThumbnailLoader({
	src,
	time,
	width,
	quality = 80,
}: {
	src: string;
	time: number;
	width: number;
	quality?: number;
}): string {
	if (!src) return "";

	try {
		const provider = detectProvider(src);

		switch (provider) {
			case "imgix": {
				// Imgix format: ?video-thumbnail=<seconds>&w=<width>&q=<quality>
				const url = new URL(src);
				url.searchParams.set("video-thumbnail", time.toString());
				url.searchParams.set("w", width.toString());
				url.searchParams.set("q", quality.toString());
				url.searchParams.set("auto", "format");
				return url.href;
			}
			case "imagekit": {
				// ImageKit format: /video.mp4/ik-thumbnail.jpg?tr=so-<seconds>,w-<width>,q-<quality>
				const url = new URL(src);
				// Remove any existing /ik-thumbnail.jpg if present
				let pathname = url.pathname.replace(/\/ik-thumbnail\.jpg$/, "");
				// Add /ik-thumbnail.jpg
				pathname = `${pathname}/ik-thumbnail.jpg`;
				url.pathname = pathname;
				url.searchParams.set("tr", `so-${time},w-${width},q-${quality},c-at_max`);
				return url.href;
			}
			default:
				// For unknown providers, return src as-is
				return src;
		}
	} catch (e) {
		console.error("Error generating video thumbnail URL:", e);
		return src;
	}
}
