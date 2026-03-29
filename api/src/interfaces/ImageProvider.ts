/**
 * Image Provider Interface
 * All image processing providers (Imgix, ImageKit, Cloudinary, etc.) must implement this interface
 */

export interface ImageUrlOptions {
	width?: number;
	height?: number;
	fit?: "crop" | "cover" | "contain" | "fill" | "scale" | "max";
	crop?: "center" | "top" | "bottom" | "left" | "right" | "faces" | "smart" | "entropy";
	quality?: number;
	format?: "jpg" | "png" | "webp" | "avif" | "gif" | "auto";
	blur?: number;
	dpr?: number;
	[key: string]: any;
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
	default: string; // Primary video URL (HLS if available, otherwise optimized 1080p or original)
	provider: string; // Base provider URL for generating custom thumbnails
	hls?: string | null; // HLS manifest URL for adaptive streaming
	mp4?: string | null; // Optimized 1080p MP4 URL for fallback
	mp4_720p?: string | null; // 720p MP4 URL for homepage
	preview?: string | null; // 480p MP4 URL for fast hover preview
	original?: string; // Original video URL for fallback
}

export interface MediaUrlSet {
	images: ImageUrlSet;
	video?: VideoUrlSet;
}

export interface ResponsiveUrls {
	srcset: string;
	sizes: string;
	src: string;
}

export interface DprUrls {
	"1x": string;
	"2x": string;
	"3x": string;
}

export interface ImageMetadata {
	src: string;
	alt: string;
	title?: string;
	loading: "lazy" | "eager";
	decoding: "async" | "sync" | "auto";
}

export type ImagePreset = "thumbnail" | "small" | "medium" | "large" | "hero" | "gallery" | "videoThumbnail";

export interface ImagePresetConfig {
	width: number;
	height: number;
	fit: string;
	crop?: string;
	quality: number;
}

/**
 * Image Provider Interface
 * Defines the contract for all image processing providers
 */
export interface IImageProvider {
	/** Provider name identifier */
	readonly name: string;

	/** Generate URL for a given storage key with custom parameters */
	generateUrl(storageKey: string, options?: ImageUrlOptions): string;

	/** Generate URL using a preset */
	generateUrlWithPreset(storageKey: string, preset: ImagePreset, additionalOptions?: ImageUrlOptions): string;

	/** Generate a complete set of URLs for different sizes */
	generateUrlSet(storageKey: string, mimeType: string, thumbnailTime?: number | null): MediaUrlSet;

	/** Generate responsive image URLs for different screen sizes */
	generateResponsiveUrls(storageKey: string, options?: ImageUrlOptions): ResponsiveUrls;

	/** Generate URLs optimized for different device pixel ratios */
	generateDprUrls(storageKey: string, options?: ImageUrlOptions): DprUrls;

	/** Generate video thumbnail URL */
	generateVideoThumbnail(storageKey: string, time?: number): string;

	/** Generate video thumbnail URL with specific dimensions */
	generateVideoThumbnailWithSize(storageKey: string, time: number, width: number, height: number): string;

	/** Generate video poster URL without size constraints */
	generateVideoPoster(storageKey: string, time?: number): string;

	/** Generate URL with smart cropping */
	generateSmartCropUrl(storageKey: string, width: number, height: number, options?: ImageUrlOptions): string;

	/** Generate URL with face detection cropping */
	generateFaceCropUrl(storageKey: string, width: number, height: number, options?: ImageUrlOptions): string;

	/** Generate URL with blur effect (useful for loading placeholders) */
	generateBlurredUrl(storageKey: string, blurAmount?: number, options?: ImageUrlOptions): string;

	/** Generate optimized URL based on file type and use case */
	generateOptimizedUrl(
		storageKey: string,
		mimeType: string,
		useCase?: "thumbnail" | "gallery" | "hero" | "preview" | "download",
		customOptions?: ImageUrlOptions
	): string;

	/** Validate if a URL belongs to this provider */
	isProviderUrl(url: string): boolean;

	/** Extract storage key from provider URL */
	extractStorageKeyFromUrl(url: string): string | null;

	/** Generate metadata for an image URL */
	generateImageMetadata(storageKey: string, alt: string, title?: string): ImageMetadata;

	/** Generate cropped image URL with explicit rect coordinates */
	generateCroppedUrl(
		storageKey: string,
		rect: { x: number; y: number; w: number; h: number },
		options?: ImageUrlOptions
	): string;
}

/**
 * Image Provider Type - supported providers
 */
export type ImageProviderType = "imgix" | "imagekit";
