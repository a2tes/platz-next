import type { NextConfig } from "next";
import { getApiUrl } from "./lib/utils";

const nextConfig: NextConfig = {
	devIndicators: false,
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
			{
				protocol: process.env.NEXT_PUBLIC_PROTOCOL as "http" | "https",
				hostname: process.env.NEXT_PUBLIC_HOSTNAME as string,
			},
			{
				protocol: process.env.NEXT_PUBLIC_PROTOCOL as "http" | "https",
				hostname: "localhost",
				port: process.env.NEXT_PUBLIC_PORT,
			},
		],
	},
	// Rewrites for storage/uploads
	async rewrites() {
		return {
			beforeFiles: [
				{
					source: "/storage/:path*",
					destination: `${getApiUrl()}/storage/:path*`,
					// "http://api.sk.test/storage/:path*",
				},
			],
		};
	},
	// Performans optimizasyonları
	reactStrictMode: false, // Double render'ı kapatır
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	// Webpack optimizasyonları
	experimental: {
		optimizePackageImports: ["gsap"],
	},
};

export default nextConfig;
