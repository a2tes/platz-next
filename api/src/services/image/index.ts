// Image Service - Main entry point
export { imageService, ImageService } from "./ImageService";

// Providers (for advanced usage or testing)
export { ImgixProvider } from "./ImgixProvider";
export { ImageKitProvider } from "./ImageKitProvider";

// Re-export types
export type {
	IImageProvider,
	ImageProviderType,
	ImageUrlOptions,
	ImagePreset,
	MediaUrlSet,
	ResponsiveUrls,
	DprUrls,
	ImageMetadata,
	ImageUrlSet,
	VideoUrlSet,
} from "../../interfaces/ImageProvider";
