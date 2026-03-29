import { imgixClient, IMGIX_PRESETS, ImgixPreset } from "../config/imgix";
import { FileValidator } from "../utils/fileValidation";

export interface ImgixUrlOptions {
	width?: number;
	height?: number;
	fit?: "clamp" | "clip" | "crop" | "facearea" | "fill" | "fillmax" | "max" | "min" | "scale";
	crop?: "top" | "bottom" | "left" | "right" | "faces" | "focalpoint" | "edges" | "entropy" | "smart";
	auto?: string; // e.g., 'compress,format'
	quality?: number;
	format?: "jpg" | "png" | "webp" | "avif" | "gif";
	dpr?: number; // Device pixel ratio
	blur?: number;
	sharpen?: number;
	brightness?: number;
	contrast?: number;
	saturation?: number;
	frame?: number; // For video thumbnails
	[key: string]: any; // Allow additional Imgix parameters
}

export interface ImageUrlSet {
	thumbnail: string;
	small: string;
	medium: string;
	large: string;
	original: string;
	hero?: string;
	gallery?: string;
}

export interface VideoUrlSet {
	default: string; // CloudFront URL for video streaming
	imgix: string; // Base Imgix URL for generating custom thumbnails
}

export interface MediaUrlSet {
	images: ImageUrlSet;
	video?: VideoUrlSet;
}

export class ImgixService {
	/**
	 * Generate Imgix URL for a given S3 key with custom parameters
	 */
	generateUrl(s3Key: string, options: ImgixUrlOptions = {}): string {
		if (!s3Key) {
			throw new Error("S3 key is required to generate Imgix URL");
		}

		try {
			return imgixClient.buildURL(s3Key, options);
		} catch (error) {
			console.error("Error generating Imgix URL:", error);
			throw new Error("Failed to generate optimized image URL");
		}
	}

	/**
	 * Generate Imgix URL using a preset
	 */
	generateUrlWithPreset(s3Key: string, preset: ImgixPreset, additionalOptions: ImgixUrlOptions = {}): string {
		const presetOptions = IMGIX_PRESETS[preset];
		const combinedOptions = { ...presetOptions, ...additionalOptions };

		return this.generateUrl(s3Key, combinedOptions);
	}

	/**
	 * Generate a complete set of URLs for different sizes
	 */
	generateUrlSet(s3Key: string, mimeType: string, thumbnailTime?: number | null): MediaUrlSet {
		const isImage = FileValidator.isImage(mimeType);
		const isVideo = FileValidator.isVideo(mimeType);

		if (!isImage && !isVideo) {
			// For non-image/video files, return the original URL
			const originalUrl = this.generateUrl(s3Key);
			return {
				images: {
					original: originalUrl,
					thumbnail: originalUrl,
					small: originalUrl,
					medium: originalUrl,
					large: originalUrl,
				},
			};
		}

		// For videos, return structured images (posters) and video URLs
		if (isVideo) {
			const videoUrl = `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_URL}/${s3Key}`;
			const frameTime = thumbnailTime != null ? thumbnailTime : 1;
			const imgixBaseUrl = this.generateUrl(s3Key);

			return {
				images: {
					thumbnail: this.generateVideoThumbnailWithSize(s3Key, frameTime, 150, 150),
					small: this.generateVideoThumbnailWithSize(s3Key, frameTime, 300, 300),
					medium: this.generateVideoThumbnailWithSize(s3Key, frameTime, 600, 600),
					large: this.generateVideoThumbnailWithSize(s3Key, frameTime, 1200, 1200),
					original: this.generateVideoPoster(s3Key, frameTime),
				},
				video: {
					default: videoUrl,
					imgix: imgixBaseUrl,
				},
			};
		}

		// For images, use standard presets
		const originalUrl = this.generateUrl(s3Key);
		const urlSet: MediaUrlSet = {
			images: {
				original: originalUrl,
				thumbnail: this.generateUrlWithPreset(s3Key, "thumbnail"),
				small: this.generateUrlWithPreset(s3Key, "small"),
				medium: this.generateUrlWithPreset(s3Key, "medium"),
				large: this.generateUrlWithPreset(s3Key, "large"),
				hero: this.generateUrlWithPreset(s3Key, "hero"),
				gallery: this.generateUrlWithPreset(s3Key, "gallery"),
			},
		};

		return urlSet;
	}

	/**
	 * Generate responsive image URLs for different screen sizes
	 */
	generateResponsiveUrls(
		s3Key: string,
		options: ImgixUrlOptions = {}
	): {
		srcset: string;
		sizes: string;
		src: string;
	} {
		const baseOptions = { auto: "compress,format", ...options };
		const widths = [320, 640, 768, 1024, 1280, 1536, 1920];

		const srcsetUrls = widths.map((width) => {
			const url = this.generateUrl(s3Key, { ...baseOptions, w: width });
			return `${url} ${width}w`;
		});

		return {
			srcset: srcsetUrls.join(", "),
			sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
			src: this.generateUrl(s3Key, { ...baseOptions, w: 800 }),
		};
	}

	/**
	 * Generate URLs optimized for different device pixel ratios
	 */
	generateDprUrls(
		s3Key: string,
		options: ImgixUrlOptions = {}
	): {
		"1x": string;
		"2x": string;
		"3x": string;
	} {
		const baseOptions = { auto: "compress,format", ...options };

		return {
			"1x": this.generateUrl(s3Key, { ...baseOptions, dpr: 1 }),
			"2x": this.generateUrl(s3Key, { ...baseOptions, dpr: 2 }),
			"3x": this.generateUrl(s3Key, { ...baseOptions, dpr: 3 }),
		};
	}

	/**
	 * Generate video thumbnail URL
	 */
	generateVideoThumbnail(s3Key: string, time: number = 1): string {
		const videoOptions: ImgixUrlOptions = {
			"video-thumbnail": time,
			auto: "format,compress",
			fit: "max" as const,
		};

		return this.generateUrl(s3Key, videoOptions);
	}

	/**
	 * Generate video thumbnail URL with specific dimensions
	 */
	generateVideoThumbnailWithSize(s3Key: string, time: number = 1, width: number, height: number): string {
		const videoOptions: ImgixUrlOptions = {
			"video-thumbnail": time,
			w: width,
			h: height,
			fit: "max" as const,
			auto: "format,compress",
		};

		return this.generateUrl(s3Key, videoOptions);
	}

	/**
	 * Generate video poster URL without size constraints (original size)
	 */
	generateVideoPoster(s3Key: string, time: number = 1): string {
		const videoOptions: ImgixUrlOptions = {
			"video-thumbnail": time,
			fit: "max" as const,
			auto: "format,compress",
		};

		return this.generateUrl(s3Key, videoOptions);
	}

	/**
	 * Generate URL with smart cropping for faces
	 */
	generateSmartCropUrl(s3Key: string, width: number, height: number, options: ImgixUrlOptions = {}): string {
		const smartCropOptions: ImgixUrlOptions = {
			w: width,
			h: height,
			fit: "crop" as const,
			crop: "smart" as const,
			auto: "compress,format",
			...options,
		};

		return this.generateUrl(s3Key, smartCropOptions);
	}

	/**
	 * Generate URL with face detection cropping
	 */
	generateFaceCropUrl(s3Key: string, width: number, height: number, options: ImgixUrlOptions = {}): string {
		const faceCropOptions: ImgixUrlOptions = {
			w: width,
			h: height,
			fit: "facearea" as const,
			facepad: 2,
			auto: "compress,format",
			...options,
		};

		return this.generateUrl(s3Key, faceCropOptions);
	}

	/**
	 * Generate URL with blur effect (useful for loading placeholders)
	 */
	generateBlurredUrl(s3Key: string, blurAmount: number = 20, options: ImgixUrlOptions = {}): string {
		const blurOptions = {
			blur: blurAmount,
			w: 50, // Small size for placeholder
			auto: "compress,format",
			...options,
		};

		return this.generateUrl(s3Key, blurOptions);
	}

	/**
	 * Generate optimized URL based on file type and use case
	 */
	generateOptimizedUrl(
		s3Key: string,
		mimeType: string,
		useCase: "thumbnail" | "gallery" | "hero" | "preview" | "download" = "preview",
		customOptions: ImgixUrlOptions = {}
	): string {
		const isImage = FileValidator.isImage(mimeType);
		const isVideo = FileValidator.isVideo(mimeType);

		// For non-media files, return original URL
		if (!isImage && !isVideo) {
			return this.generateUrl(s3Key);
		}

		let baseOptions: ImgixUrlOptions = {};

		switch (useCase) {
			case "thumbnail":
				baseOptions = IMGIX_PRESETS.thumbnail;
				break;
			case "gallery":
				baseOptions = IMGIX_PRESETS.gallery;
				break;
			case "hero":
				baseOptions = IMGIX_PRESETS.hero;
				break;
			case "preview":
				baseOptions = IMGIX_PRESETS.medium;
				break;
			case "download":
				// For download, return original without transformations
				return this.generateUrl(s3Key);
		}

		// For videos, add frame extraction for thumbnails
		if (isVideo && useCase !== ("download" as any)) {
			baseOptions = { ...baseOptions, frame: 1 };
		}

		const finalOptions = { ...baseOptions, ...customOptions };
		return this.generateUrl(s3Key, finalOptions);
	}

	/**
	 * Validate if a URL is a valid Imgix URL
	 */
	isImgixUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			return (
				urlObj.hostname.includes("imgix.net") || urlObj.hostname.includes(process.env.NEXT_PUBLIC_IMGIX_DOMAIN || "")
			);
		} catch {
			return false;
		}
	}

	/**
	 * Extract S3 key from Imgix URL
	 */
	extractS3KeyFromUrl(imgixUrl: string): string | null {
		try {
			const urlObj = new URL(imgixUrl);
			// Remove leading slash and return the path as S3 key
			return urlObj.pathname.substring(1);
		} catch {
			return null;
		}
	}

	/**
	 * Generate metadata for an image URL (useful for SEO and accessibility)
	 */
	generateImageMetadata(
		s3Key: string,
		alt: string,
		title?: string
	): {
		src: string;
		alt: string;
		title?: string;
		loading: "lazy" | "eager";
		decoding: "async" | "sync" | "auto";
	} {
		return {
			src: this.generateUrlWithPreset(s3Key, "medium"),
			alt,
			title,
			loading: "lazy",
			decoding: "async",
		};
	}
}

// Export singleton instance
export const imgixService = new ImgixService();
