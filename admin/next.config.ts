import type { NextConfig } from "next";
import path from "path";

const IMGIX_DOMAIN = process.env.NEXT_PUBLIC_IMGIX_URL || "";
const IMAGEKIT_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";
const PROTOCOL = (process.env.NEXT_PUBLIC_PROTOCOL || "http") as "http" | "https";
const HOSTNAME = process.env.NEXT_PUBLIC_HOSTNAME || "localhost";

// Resolve the actual admin directory path
const adminRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
	turbopack: {
		// Set root to admin directory to fix workspace detection
		root: adminRoot,
	},
	images: {
		loader: "custom",
		loaderFile: "./src/lib/imageLoader.ts",
		remotePatterns: [
			// Imgix domains
			{
				protocol: "https",
				hostname: "**.imgix.net",
			},
			// ImageKit domains
			{
				protocol: "https",
				hostname: "ik.imagekit.io",
			},
			// Local backend uploads
			{
				protocol: PROTOCOL,
				hostname: HOSTNAME,
				pathname: "/uploads/**",
			},
			// Cropped image proxy endpoint (public)
			{
				protocol: PROTOCOL,
				hostname: `api.${HOSTNAME}`,
				pathname: "/api/media/crop/**",
			},
			// Optional explicit Imgix custom domain via env
			...(IMGIX_DOMAIN
				? [
						{
							protocol: "https",
							hostname: IMGIX_DOMAIN,
							pathname: "/**",
						} as const,
					]
				: []),
			// Optional explicit ImageKit custom endpoint via env
			...(IMAGEKIT_ENDPOINT
				? [
						{
							protocol: "https",
							hostname: new URL(IMAGEKIT_ENDPOINT).hostname,
							pathname: "/**",
						} as const,
					]
				: []),
		],
	},
	outputFileTracingRoot: __dirname,
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{
						key: "Access-Control-Allow-Methods",
						value: "GET,POST,PUT,DELETE,OPTIONS",
					},
					{
						key: "Access-Control-Allow-Headers",
						value: "Content-Type, Authorization",
					},
				],
			},
		];
	},
};

export default nextConfig;
