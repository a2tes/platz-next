import { config } from "dotenv";
import {
	IImageProvider,
	ImageUrlOptions,
	ImagePreset,
	MediaUrlSet,
	ResponsiveUrls,
	DprUrls,
	ImageMetadata,
} from "../../interfaces/ImageProvider";
import { FileValidator } from "../../utils/fileValidation";

config();

// ImageKit configuration
const IMAGEKIT_CONFIG = {
	urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/your_id",
	publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
	privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
};

// ImageKit-specific presets (using transformation string format)
const IMAGEKIT_PRESETS: Record<ImagePreset, Record<string, any>> = {
	thumbnail: {
		w: 150,
		h: 150,
		c: "maintain_ratio",
		fo: "auto",
		q: 75,
	},
	small: {
		w: 300,
		h: 300,
		c: "at_max",
		q: 80,
	},
	medium: {
		w: 600,
		h: 600,
		c: "at_max",
		q: 85,
	},
	large: {
		w: 1200,
		h: 1200,
		c: "at_max",
		q: 90,
	},
	hero: {
		w: 1920,
		h: 1080,
		c: "maintain_ratio",
		fo: "auto",
		q: 90,
	},
	gallery: {
		w: 800,
		h: 600,
		c: "maintain_ratio",
		fo: "auto",
		q: 85,
	},
	videoThumbnail: {
		w: 640,
		h: 360,
		c: "maintain_ratio",
		fo: "auto",
		q: 80,
	},
};

/**
 * ImageKit Provider Implementation
 * Implements IImageProvider interface for ImageKit image processing service
 *
 * ImageKit URL format: https://ik.imagekit.io/<your_id>/<path>?tr=<transformations>
 * Or with path-based transformations: https://ik.imagekit.io/<your_id>/tr:<transformations>/<path>
 */
export class ImageKitProvider implements IImageProvider {
	readonly name = "imagekit";

	/**
	 * Convert generic options to ImageKit transformation string
	 */
	private buildTransformationString(options: Record<string, any>): string {
		const transforms: string[] = [];

		Object.entries(options).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				transforms.push(`${key}-${value}`);
			}
		});

		return transforms.join(",");
	}

	/**
	 * Convert generic options to ImageKit-specific parameters
	 */
	private mapOptionsToImageKit(options: ImageUrlOptions): Record<string, any> {
		const ikOptions: Record<string, any> = {};

		if (options.width) ikOptions.w = options.width;
		if (options.height) ikOptions.h = options.height;
		if (options.quality) ikOptions.q = options.quality;
		if (options.blur) ikOptions.bl = options.blur;
		if (options.dpr) ikOptions.dpr = options.dpr;

		// Map fit values to ImageKit crop modes
		if (options.fit) {
			const fitMap: Record<string, string> = {
				crop: "maintain_ratio",
				cover: "maintain_ratio",
				contain: "at_max",
				fill: "pad_resize",
				scale: "force",
				max: "at_max",
			};
			ikOptions.c = fitMap[options.fit] || "maintain_ratio";
		}

		// Map crop/focus values
		if (options.crop) {
			const focusMap: Record<string, string> = {
				center: "center",
				top: "top",
				bottom: "bottom",
				left: "left",
				right: "right",
				faces: "face",
				smart: "auto",
				entropy: "auto",
			};
			ikOptions.fo = focusMap[options.crop] || "auto";
		}

		// Map format
		if (options.format && options.format !== "auto") {
			ikOptions.f = options.format;
		}

		return ikOptions;
	}

	/**
	 * Build ImageKit URL with transformations
	 */
	private buildUrl(storageKey: string, transformations: Record<string, any> = {}): string {
		const baseUrl = IMAGEKIT_CONFIG.urlEndpoint.replace(/\/$/, "");
		const path = storageKey.startsWith("/") ? storageKey : `/${storageKey}`;

		if (Object.keys(transformations).length === 0) {
			return `${baseUrl}${path}`;
		}

		const trString = this.buildTransformationString(transformations);
		return `${baseUrl}${path}?tr=${trString}`;
	}

	generateUrl(storageKey: string, options: ImageUrlOptions = {}): string {
		if (!storageKey) {
			throw new Error("Storage key is required to generate image URL");
		}

		try {
			const ikOptions = this.mapOptionsToImageKit(options);
			return this.buildUrl(storageKey, ikOptions);
		} catch (error) {
			console.error("Error generating ImageKit URL:", error);
			throw new Error("Failed to generate optimized image URL");
		}
	}

	generateUrlWithPreset(storageKey: string, preset: ImagePreset, additionalOptions: ImageUrlOptions = {}): string {
		const presetOptions = IMAGEKIT_PRESETS[preset];
		const additionalMapped = this.mapOptionsToImageKit(additionalOptions);
		const combinedOptions = { ...presetOptions, ...additionalMapped };

		return this.buildUrl(storageKey, combinedOptions);
	}

	generateUrlSet(storageKey: string, mimeType: string, thumbnailTime?: number | null): MediaUrlSet {
		const isImage = FileValidator.isImage(mimeType);
		const isVideo = FileValidator.isVideo(mimeType);

		if (!isImage && !isVideo) {
			const originalUrl = this.generateUrl(storageKey);
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

		if (isVideo) {
			const videoUrl = `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_URL}/${storageKey}`;
			const frameTime = thumbnailTime != null ? thumbnailTime : 1;
			const providerBaseUrl = this.generateUrl(storageKey);

			return {
				images: {
					thumbnail: this.generateVideoThumbnailWithSize(storageKey, frameTime, 150, 150),
					small: this.generateVideoThumbnailWithSize(storageKey, frameTime, 300, 300),
					medium: this.generateVideoThumbnailWithSize(storageKey, frameTime, 600, 600),
					large: this.generateVideoThumbnailWithSize(storageKey, frameTime, 1200, 1200),
					original: this.generateVideoPoster(storageKey, frameTime),
				},
				video: {
					default: videoUrl,
					provider: providerBaseUrl,
				},
			};
		}

		return {
			images: {
				original: this.generateUrl(storageKey),
				thumbnail: this.generateUrlWithPreset(storageKey, "thumbnail"),
				small: this.generateUrlWithPreset(storageKey, "small"),
				medium: this.generateUrlWithPreset(storageKey, "medium"),
				large: this.generateUrlWithPreset(storageKey, "large"),
				hero: this.generateUrlWithPreset(storageKey, "hero"),
				gallery: this.generateUrlWithPreset(storageKey, "gallery"),
			},
		};
	}

	generateResponsiveUrls(storageKey: string, options: ImageUrlOptions = {}): ResponsiveUrls {
		const widths = [320, 640, 768, 1024, 1280, 1536, 1920];

		const srcsetUrls = widths.map((width) => {
			const url = this.generateUrl(storageKey, { ...options, width });
			return `${url} ${width}w`;
		});

		return {
			srcset: srcsetUrls.join(", "),
			sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
			src: this.generateUrl(storageKey, { ...options, width: 800 }),
		};
	}

	generateDprUrls(storageKey: string, options: ImageUrlOptions = {}): DprUrls {
		return {
			"1x": this.generateUrl(storageKey, { ...options, dpr: 1 }),
			"2x": this.generateUrl(storageKey, { ...options, dpr: 2 }),
			"3x": this.generateUrl(storageKey, { ...options, dpr: 3 }),
		};
	}

	/**
	 * Generate video thumbnail URL using ImageKit's video thumbnail feature
	 * ImageKit uses /ik-thumbnail.jpg with so (start offset) parameter
	 * https://imagekit.io/docs/create-video-thumbnails#get-thumbnail-from-a-specific-time-point
	 */
	generateVideoThumbnail(storageKey: string, time: number = 1): string {
		const baseUrl = IMAGEKIT_CONFIG.urlEndpoint.replace(/\/$/, "");
		const path = storageKey.startsWith("/") ? storageKey : `/${storageKey}`;

		// ImageKit video thumbnail format: /video.mp4/ik-thumbnail.jpg?tr=so-<seconds>
		return `${baseUrl}${path}/ik-thumbnail.jpg?tr=so-${time}`;
	}

	generateVideoThumbnailWithSize(storageKey: string, time: number = 1, width: number, height: number): string {
		const baseUrl = IMAGEKIT_CONFIG.urlEndpoint.replace(/\/$/, "");
		const path = storageKey.startsWith("/") ? storageKey : `/${storageKey}`;

		// Combine video thumbnail with size transformations
		const transforms = `so-${time},w-${width},h-${height},c-at_max`;
		return `${baseUrl}${path}/ik-thumbnail.jpg?tr=${transforms}`;
	}

	generateVideoPoster(storageKey: string, time: number = 1): string {
		const baseUrl = IMAGEKIT_CONFIG.urlEndpoint.replace(/\/$/, "");
		const path = storageKey.startsWith("/") ? storageKey : `/${storageKey}`;

		return `${baseUrl}${path}/ik-thumbnail.jpg?tr=so-${time}`;
	}

	generateSmartCropUrl(storageKey: string, width: number, height: number, options: ImageUrlOptions = {}): string {
		return this.generateUrl(storageKey, {
			width,
			height,
			fit: "crop",
			crop: "smart",
			...options,
		});
	}

	generateFaceCropUrl(storageKey: string, width: number, height: number, options: ImageUrlOptions = {}): string {
		const ikOptions = this.mapOptionsToImageKit(options);
		return this.buildUrl(storageKey, {
			w: width,
			h: height,
			c: "maintain_ratio",
			fo: "face",
			...ikOptions,
		});
	}

	generateBlurredUrl(storageKey: string, blurAmount: number = 20, options: ImageUrlOptions = {}): string {
		return this.generateUrl(storageKey, {
			blur: blurAmount,
			width: 50,
			...options,
		});
	}

	generateOptimizedUrl(
		storageKey: string,
		mimeType: string,
		useCase: "thumbnail" | "gallery" | "hero" | "preview" | "download" = "preview",
		customOptions: ImageUrlOptions = {}
	): string {
		const isImage = FileValidator.isImage(mimeType);
		const isVideo = FileValidator.isVideo(mimeType);

		if (!isImage && !isVideo) {
			return this.generateUrl(storageKey);
		}

		if (useCase === "download") {
			return this.generateUrl(storageKey);
		}

		const presetMap: Record<string, ImagePreset> = {
			thumbnail: "thumbnail",
			gallery: "gallery",
			hero: "hero",
			preview: "medium",
		};

		const preset = presetMap[useCase] || "medium";

		if (isVideo) {
			return this.generateVideoThumbnail(storageKey, 1);
		}

		return this.generateUrlWithPreset(storageKey, preset, customOptions);
	}

	isProviderUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.includes("imagekit.io") || url.includes(IMAGEKIT_CONFIG.urlEndpoint);
		} catch {
			return false;
		}
	}

	extractStorageKeyFromUrl(url: string): string | null {
		try {
			const urlObj = new URL(url);
			let path = urlObj.pathname;

			// Remove the ImageKit ID prefix if present
			const endpoint = new URL(IMAGEKIT_CONFIG.urlEndpoint);
			const endpointPath = endpoint.pathname;
			if (path.startsWith(endpointPath)) {
				path = path.substring(endpointPath.length);
			}

			// Remove ik-thumbnail.jpg suffix if present
			path = path.replace(/\/ik-thumbnail\.jpg$/, "");

			// Remove leading slash
			return path.startsWith("/") ? path.substring(1) : path;
		} catch {
			return null;
		}
	}

	generateImageMetadata(storageKey: string, alt: string, title?: string): ImageMetadata {
		return {
			src: this.generateUrlWithPreset(storageKey, "medium"),
			alt,
			title,
			loading: "lazy",
			decoding: "async",
		};
	}

	generateCroppedUrl(
		storageKey: string,
		rect: { x: number; y: number; w: number; h: number },
		options: ImageUrlOptions = {}
	): string {
		// ImageKit uses cm-extract for custom crop regions
		// Format: cm-extract,x-<x>,y-<y>,w-<w>,h-<h>
		const ikOptions = this.mapOptionsToImageKit(options);
		const cropTransform = `cm-extract,x-${rect.x},y-${rect.y},w-${rect.w},h-${rect.h}`;

		const baseUrl = IMAGEKIT_CONFIG.urlEndpoint.replace(/\/$/, "");
		const path = storageKey.startsWith("/") ? storageKey : `/${storageKey}`;

		const additionalTransforms = this.buildTransformationString(ikOptions);
		const allTransforms = additionalTransforms ? `${cropTransform},${additionalTransforms}` : cropTransform;

		return `${baseUrl}${path}?tr=${allTransforms}`;
	}
}
