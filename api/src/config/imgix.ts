import ImgixClient from "@imgix/js-core";
import { config } from "dotenv";

config();

// Imgix configuration from environment variables
export const IMGIX_CONFIG = {
	domain: process.env.NEXT_PUBLIC_IMGIX_URL,
	secureUrlToken: process.env.NEXT_PUBLIC_IMGIX_SECURE_URL_TOKEN || "",
	useHttps: true,
	includeLibraryParam: false,
};

// Create Imgix client instance
// Use a fallback domain to prevent crash if env var is missing
export const imgixClient = new ImgixClient({
	domain: IMGIX_CONFIG.domain || "example.imgix.net",
	secureURLToken: IMGIX_CONFIG.secureUrlToken,
	useHTTPS: IMGIX_CONFIG.useHttps,
	includeLibraryParam: IMGIX_CONFIG.includeLibraryParam,
});

// Common image transformation presets
export const IMGIX_PRESETS = {
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
	// Video thumbnail preset
	videoThumbnail: {
		w: 640,
		h: 360,
		fit: "crop",
		crop: "smart",
		auto: "compress,format",
		q: 80,
		frame: 1, // Extract first frame for video thumbnails
	},
} as const;

export type ImgixPreset = keyof typeof IMGIX_PRESETS;
