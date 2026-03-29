import type { CorsOptions } from "cors";

export function getAllowedOrigins(): string[] {
	const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const defaults = [
		`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}`,
		`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}`,
		`${process.env.NEXT_PUBLIC_PROTOCOL}://admin.${process.env.NEXT_PUBLIC_HOSTNAME}`,
	];
	return Array.from(new Set([...envOrigins, ...defaults]));
}

export function isOriginAllowed(origin?: string | null): boolean {
	if (!origin) return true; // same-origin or non-browser
	const allowed = getAllowedOrigins();
	return allowed.includes(origin);
}

export function buildCorsOptions(): CorsOptions {
	return {
		origin(origin, callback) {
			if (isOriginAllowed(origin)) return callback(null, true);
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
		exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
	};
}
