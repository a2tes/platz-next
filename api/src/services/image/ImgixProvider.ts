import ImgixClient from "@imgix/js-core";
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

// Imgix configuration
const IMGIX_CONFIG = {
	domain: process.env.NEXT_PUBLIC_IMGIX_URL || "example.imgix.net",
	secureUrlToken: process.env.NEXT_PUBLIC_IMGIX_SECURE_URL_TOKEN || "",
	useHttps: true,
	includeLibraryParam: false,
};

// Create Imgix client instance
const imgixClient = new ImgixClient({
	domain: IMGIX_CONFIG.domain,
	secureURLToken: IMGIX_CONFIG.secureUrlToken,
	useHTTPS: IMGIX_CONFIG.useHttps,
	includeLibraryParam: IMGIX_CONFIG.includeLibraryParam,
});

// Imgix-specific presets
const IMGIX_PRESETS = {
	thumbnail: {
		w: 150,
		h: 150,
		fit: "crop",
		crop: "smart",
		auto: "compress,format",
		q: 75,
	},
	small: {
		w: 300,
		h: 300,
		fit: "max",
		auto: "compress,format",
		q: 80,
	},
	medium: {
		w: 600,
		h: 600,
		fit: "max",
		auto: "compress,format",
		q: 85,
	},
	large: {
		w: 1200,
		h: 1200,
		fit: "max",
		auto: "compress,format",
		q: 90,
	},
	hero: {
		w: 1920,
		h: 1080,
		fit: "crop",
		crop: "smart",
		auto: "compress,format",
		q: 90,
	},
	gallery: {
		w: 800,
		h: 600,
		fit: "crop",
		crop: "smart",
		auto: "compress,format",
		q: 85,
	},
	videoThumbnail: {
		w: 640,
		h: 360,
		fit: "crop",
		crop: "smart",
		auto: "compress,format",
		q: 80,
		frame: 1,
	},
} as const;

/**
 * Imgix Provider Implementation
 * Implements IImageProvider interface for Imgix image processing service
 */
export class ImgixProvider implements IImageProvider {
	readonly name = "imgix";

	/**
	 * Convert generic options to Imgix-specific parameters
	 */
	private mapOptionsToImgix(options: ImageUrlOptions): Record<string, any> {
		const imgixOptions: Record<string, any> = {};

		if (options.width) imgixOptions.w = options.width;
		if (options.height) imgixOptions.h = options.height;
		if (options.quality) imgixOptions.q = options.quality;
		if (options.blur) imgixOptions.blur = options.blur;
		if (options.dpr) imgixOptions.dpr = options.dpr;

		// Map fit values
		if (options.fit) {
			const fitMap: Record<string, string> = {
				crop: "crop",
				cover: "crop",
				contain: "max",
				fill: "fill",
				scale: "scale",
				max: "max",
			};
			imgixOptions.fit = fitMap[options.fit] || options.fit;
		}

		// Map crop values
		if (options.crop) {
			const cropMap: Record<string, string> = {
				center: "center",
				top: "top",
				bottom: "bottom",
				left: "left",
				right: "right",
				faces: "faces",
				smart: "smart",
				entropy: "entropy",
			};
			imgixOptions.crop = cropMap[options.crop] || options.crop;
		}

		// Map format
		if (options.format) {
			if (options.format === "auto") {
				imgixOptions.auto = "compress,format";
			} else {
				imgixOptions.fm = options.format;
			}
		}

		// Pass through any additional Imgix-specific options
		Object.keys(options).forEach((key) => {
			if (!["width", "height", "quality", "blur", "dpr", "fit", "crop", "format"].includes(key)) {
				imgixOptions[key] = options[key];
			}
		});

		return imgixOptions;
	}

	generateUrl(storageKey: string, options: ImageUrlOptions = {}): string {
		if (!storageKey) {
			throw new Error("Storage key is required to generate image URL");
		}

		try {
			const imgixOptions = this.mapOptionsToImgix(options);
			return imgixClient.buildURL(storageKey, imgixOptions);
		} catch (error) {
			console.error("Error generating Imgix URL:", error);
			throw new Error("Failed to generate optimized image URL");
		}
	}

	generateUrlWithPreset(storageKey: string, preset: ImagePreset, additionalOptions: ImageUrlOptions = {}): string {
		const presetOptions = IMGIX_PRESETS[preset];
		// Combine preset with additional options (preset is already in Imgix format)
		const imgixOptions = { ...presetOptions, ...this.mapOptionsToImgix(additionalOptions) };

		try {
			return imgixClient.buildURL(storageKey, imgixOptions);
		} catch (error) {
			console.error("Error generating Imgix URL with preset:", error);
			throw new Error("Failed to generate optimized image URL");
		}
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
		const baseOptions = { format: "auto" as const, ...options };
		const widths = [320, 640, 768, 1024, 1280, 1536, 1920];

		const srcsetUrls = widths.map((width) => {
			const url = this.generateUrl(storageKey, { ...baseOptions, width });
			return `${url} ${width}w`;
		});

		return {
			srcset: srcsetUrls.join(", "),
			sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
			src: this.generateUrl(storageKey, { ...baseOptions, width: 800 }),
		};
	}

	generateDprUrls(storageKey: string, options: ImageUrlOptions = {}): DprUrls {
		const baseOptions = { format: "auto" as const, ...options };

		return {
			"1x": this.generateUrl(storageKey, { ...baseOptions, dpr: 1 }),
			"2x": this.generateUrl(storageKey, { ...baseOptions, dpr: 2 }),
			"3x": this.generateUrl(storageKey, { ...baseOptions, dpr: 3 }),
		};
	}

	generateVideoThumbnail(storageKey: string, time: number = 1): string {
		return imgixClient.buildURL(storageKey, {
			"video-thumbnail": time,
			auto: "format,compress",
			fit: "max",
		});
	}

	generateVideoThumbnailWithSize(storageKey: string, time: number = 1, width: number, height: number): string {
		return imgixClient.buildURL(storageKey, {
			"video-thumbnail": time,
			w: width,
			h: height,
			fit: "max",
			auto: "format,compress",
		});
	}

	generateVideoPoster(storageKey: string, time: number = 1): string {
		return imgixClient.buildURL(storageKey, {
			"video-thumbnail": time,
			fit: "max",
			auto: "format,compress",
		});
	}

	generateSmartCropUrl(storageKey: string, width: number, height: number, options: ImageUrlOptions = {}): string {
		return this.generateUrl(storageKey, {
			width,
			height,
			fit: "crop",
			crop: "smart",
			format: "auto",
			...options,
		});
	}

	generateFaceCropUrl(storageKey: string, width: number, height: number, options: ImageUrlOptions = {}): string {
		return imgixClient.buildURL(storageKey, {
			w: width,
			h: height,
			fit: "facearea",
			facepad: 2,
			auto: "compress,format",
			...this.mapOptionsToImgix(options),
		});
	}

	generateBlurredUrl(storageKey: string, blurAmount: number = 20, options: ImageUrlOptions = {}): string {
		return this.generateUrl(storageKey, {
			blur: blurAmount,
			width: 50,
			format: "auto",
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
			return urlObj.hostname.includes("imgix.net") || urlObj.hostname.includes(IMGIX_CONFIG.domain);
		} catch {
			return false;
		}
	}

	extractStorageKeyFromUrl(url: string): string | null {
		try {
			const urlObj = new URL(url);
			return urlObj.pathname.substring(1);
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
		const rectString = `${rect.x},${rect.y},${rect.w},${rect.h}`;
		return imgixClient.buildURL(storageKey, {
			rect: rectString,
			...this.mapOptionsToImgix(options),
		});
	}
}
