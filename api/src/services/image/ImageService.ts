import { config } from "dotenv";
import {
	IImageProvider,
	ImageProviderType,
	ImageUrlOptions,
	ImagePreset,
	MediaUrlSet,
	ResponsiveUrls,
	DprUrls,
	ImageMetadata,
} from "../../interfaces/ImageProvider";
import { ImgixProvider } from "./ImgixProvider";
import { ImageKitProvider } from "./ImageKitProvider";

config();

/**
 * ImageService - Main service for image processing
 * Uses Strategy Pattern to delegate to the appropriate provider based on configuration
 *
 * Usage:
 *   import { imageService } from './services/image/ImageService';
 *   const url = imageService.generateUrl('path/to/image.jpg', { width: 800 });
 *
 * Configuration:
 *   Set IMAGE_PROVIDER environment variable to 'imgix' or 'imagekit'
 *   Default: 'imgix'
 */
class ImageService implements IImageProvider {
	private provider: IImageProvider;
	private providerType: ImageProviderType;

	constructor() {
		this.providerType = this.getProviderType();
		this.provider = this.createProvider(this.providerType);
		console.log(`[ImageService] Initialized with provider: ${this.providerType}`);
	}

	/**
	 * Get the provider type from environment variable
	 */
	private getProviderType(): ImageProviderType {
		const providerEnv = process.env.IMAGE_PROVIDER?.toLowerCase();

		if (providerEnv === "imagekit") {
			return "imagekit";
		}

		// Default to imgix for backward compatibility
		return "imgix";
	}

	/**
	 * Create provider instance based on type
	 */
	private createProvider(type: ImageProviderType): IImageProvider {
		switch (type) {
			case "imagekit":
				return new ImageKitProvider();
			case "imgix":
			default:
				return new ImgixProvider();
		}
	}

	/**
	 * Get the current provider name
	 */
	get name(): string {
		return this.provider.name;
	}

	/**
	 * Get the current provider type
	 */
	get currentProvider(): ImageProviderType {
		return this.providerType;
	}

	/**
	 * Get the underlying provider instance (for advanced usage)
	 */
	getProvider(): IImageProvider {
		return this.provider;
	}

	/**
	 * Switch to a different provider at runtime (useful for testing)
	 */
	switchProvider(type: ImageProviderType): void {
		this.providerType = type;
		this.provider = this.createProvider(type);
		console.log(`[ImageService] Switched to provider: ${type}`);
	}

	// Delegate all IImageProvider methods to the current provider

	generateUrl(storageKey: string, options?: ImageUrlOptions): string {
		return this.provider.generateUrl(storageKey, options);
	}

	generateUrlWithPreset(storageKey: string, preset: ImagePreset, additionalOptions?: ImageUrlOptions): string {
		return this.provider.generateUrlWithPreset(storageKey, preset, additionalOptions);
	}

	generateUrlSet(storageKey: string, mimeType: string, thumbnailTime?: number | null): MediaUrlSet {
		return this.provider.generateUrlSet(storageKey, mimeType, thumbnailTime);
	}

	generateResponsiveUrls(storageKey: string, options?: ImageUrlOptions): ResponsiveUrls {
		return this.provider.generateResponsiveUrls(storageKey, options);
	}

	generateDprUrls(storageKey: string, options?: ImageUrlOptions): DprUrls {
		return this.provider.generateDprUrls(storageKey, options);
	}

	generateVideoThumbnail(storageKey: string, time?: number): string {
		return this.provider.generateVideoThumbnail(storageKey, time);
	}

	generateVideoThumbnailWithSize(storageKey: string, time: number, width: number, height: number): string {
		return this.provider.generateVideoThumbnailWithSize(storageKey, time, width, height);
	}

	generateVideoPoster(storageKey: string, time?: number): string {
		return this.provider.generateVideoPoster(storageKey, time);
	}

	generateSmartCropUrl(storageKey: string, width: number, height: number, options?: ImageUrlOptions): string {
		return this.provider.generateSmartCropUrl(storageKey, width, height, options);
	}

	generateFaceCropUrl(storageKey: string, width: number, height: number, options?: ImageUrlOptions): string {
		return this.provider.generateFaceCropUrl(storageKey, width, height, options);
	}

	generateBlurredUrl(storageKey: string, blurAmount?: number, options?: ImageUrlOptions): string {
		return this.provider.generateBlurredUrl(storageKey, blurAmount, options);
	}

	generateOptimizedUrl(
		storageKey: string,
		mimeType: string,
		useCase?: "thumbnail" | "gallery" | "hero" | "preview" | "download",
		customOptions?: ImageUrlOptions
	): string {
		return this.provider.generateOptimizedUrl(storageKey, mimeType, useCase, customOptions);
	}

	isProviderUrl(url: string): boolean {
		return this.provider.isProviderUrl(url);
	}

	extractStorageKeyFromUrl(url: string): string | null {
		return this.provider.extractStorageKeyFromUrl(url);
	}

	generateImageMetadata(storageKey: string, alt: string, title?: string): ImageMetadata {
		return this.provider.generateImageMetadata(storageKey, alt, title);
	}

	generateCroppedUrl(
		storageKey: string,
		rect: { x: number; y: number; w: number; h: number },
		options?: ImageUrlOptions
	): string {
		return this.provider.generateCroppedUrl(storageKey, rect, options);
	}
}

// Export singleton instance
export const imageService = new ImageService();

// Export class for testing purposes
export { ImageService };

// Re-export types for convenience
export type {
	IImageProvider,
	ImageProviderType,
	ImageUrlOptions,
	ImagePreset,
	MediaUrlSet,
	ResponsiveUrls,
	DprUrls,
	ImageMetadata,
} from "../../interfaces/ImageProvider";
