import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

// Import routes
import authRoutes from "./routes/auth";
import mediaRoutes from "./routes/media";
import dashboardRoutes from "./routes/dashboard";
import worksRoutes from "./routes/works";
import animationsRoutes from "./routes/animations";
import homepageRoutes from "./routes/homepage";
import directorsPageRoutes from "./routes/directorsPage";
import contentRoutes from "./routes/content";
import usersRoutes from "./routes/users";
import photographyRoutes from "./routes/photography";
import publicWorksRoutes from "./routes/public/works";
import publicAnimationsRoutes from "./routes/public/animations";
import publicHomepageRoutes from "./routes/public/homepage";
import publicPagesRoutes from "./routes/public/pages";
import publicPhotographyRoutes from "./routes/public/photography";
import publicPhotographersRoutes from "./routes/public/photographers";
import publicPhotoCategoriesRoutes from "./routes/public/photoCategories";
import publicNavbarRoutes from "./routes/public/navbar";
import publicDirectorsRoutes from "./routes/public/directors";
import publicDirectorsPageRoutes from "./routes/public/directorsPage";
import presentationRoutes from "./routes/presentation";
import publicPresentationRoutes from "./routes/public/presentation";
import blocksRoutes from "./routes/blocks";
import clipJobsRoutes from "./routes/clipJobs";
import clientsRoutes from "./routes/clients";
import disciplinesRoutes from "./routes/disciplines";
import sectorsRoutes from "./routes/sectors";
import utilsRevalidateRoute from "./routes/utils/revalidate";
import mediaConvertWebhook from "./routes/webhooks/mediaConvert";
import adminCleanupRoutes from "./routes/admin/cleanup";
import settingsRoutes from "./routes/settings";
import pageSeoRoutes from "./routes/pageSeo";
import publicPageSeoRoutes from "./routes/public/pageSeo";
import publicSettingsRoutes from "./routes/public/settings";
import { rateLimit } from "./middleware/rateLimiter";
import cron from "node-cron";
import { mediaCleanupService } from "./services/mediaCleanupService";
import { startClipSyncService } from "./services/clipSyncService";

// Import middleware
import { apiRateLimit } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Import database
import { database } from "./config/database";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.NEXT_PUBLIC_PORT || 8000;
const API_URL =
	`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}` || `http://localhost:${PORT}`;
const STORAGE_URL =
	`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}/storage` ||
	`http://localhost:${PORT}/storage`;

console.log("Starting API Server...");
console.log(`> API Server URL: ${API_URL}`);
console.log(`> Storage URL: ${STORAGE_URL}`);

// Security middleware
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", "data:", "https:", STORAGE_URL],
				connectSrc: ["'self'"],
				fontSrc: ["'self'"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'", STORAGE_URL],
				frameSrc: ["'none'"],
			},
		},
		crossOriginEmbedderPolicy: false,
		crossOriginResourcePolicy: { policy: "cross-origin" },
	}),
);

// CORS configuration with allowlist (supports comma-separated env)
import { buildCorsOptions } from "./utils/cors";
app.use(cors(buildCorsOptions()));

// Strong ETag for better cache validation
app.set("etag", "strong");

// Logging middleware
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Body parsing middleware
app.use(
	express.json({
		limit: "10mb",
		type: ["application/json", "text/plain"],
	}),
);
app.use(
	express.urlencoded({
		extended: true,
		limit: "10mb",
	}),
);

// Cookie parsing middleware
app.use(cookieParser());

// Serve uploaded files statically with CORS headers
// Use MEDIA_LIBRARY_LOCAL_PATH env var or fall back to storage/uploads
const uploadsDir = path.resolve(process.env.MEDIA_LIBRARY_LOCAL_PATH || path.join(process.cwd(), "../storage/uploads"));
app.use(
	"/storage",
	(req, res, next) => {
		// Set CORS headers for uploaded files
		res.header("Cross-Origin-Resource-Policy", "cross-origin");
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		next();
	},
	express.static(uploadsDir),
);

// Legacy /uploads route for backward compatibility
app.use(
	"/uploads",
	(req, res, next) => {
		res.header("Cross-Origin-Resource-Policy", "cross-origin");
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		next();
	},
	express.static(uploadsDir),
);

// Apply rate limiting only to public endpoints (not authenticated routes)
// Authenticated routes will have their own rate limiting if needed

// Health check endpoint
app.get("/health", async (req, res) => {
	const dbHealth = await database.healthCheck();

	res.json({
		status: "OK",
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || "development",
		database: dbHealth,
	});
});

// API routes
app.get("/api", (req, res) => {
	res.json({
		message: "Platz Admin Panel API",
		version: "1.0.0",
		endpoints: {
			health: "/health",
			auth: "/api/auth",
			media: "/api/media",
			dashboard: "/api/dashboard",
			works: "/api/works",
			homepage: "/api/homepage",
			photography: "/api/photography",
			content: "/api/content",
			users: "/api/users",
			api: "/api",
		},
	});
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Media routes
app.use("/api/media", mediaRoutes);

// Dashboard routes
app.use("/api/dashboard", dashboardRoutes);

// Works routes
app.use("/api/works", worksRoutes);

// Animations routes
app.use("/api/animations", animationsRoutes);

// Homepage routes
app.use("/api/homepage", homepageRoutes);

app.use("/api/directors-page", directorsPageRoutes);

// Photography routes
app.use("/api/photography", photographyRoutes);

// Content routes
app.use("/api/content", contentRoutes);

// Users routes
app.use("/api/users", usersRoutes);

// Presentation routes
app.use("/api/presentations", presentationRoutes);

// Blocks routes
app.use("/api/blocks", blocksRoutes);

// Clip Jobs routes
app.use("/api/clip-jobs", clipJobsRoutes);

// Clients routes
app.use("/api/clients", clientsRoutes);

// Disciplines routes
app.use("/api/disciplines", disciplinesRoutes);

// Sectors routes
app.use("/api/sectors", sectorsRoutes);

// Admin routes
app.use("/api/admin/cleanup", adminCleanupRoutes);

// Settings routes
app.use("/api/settings", settingsRoutes);

// Page SEO routes
app.use("/api/page-seo", pageSeoRoutes);

// Public routes (no auth)
const publicRate = rateLimit({
	windowMs: 5 * 60 * 1000,
	maxRequests: process.env.NODE_ENV === "production" ? 300 : 10000,
	message: "Too many requests to public API",
});
app.use("/api/public", publicRate);
app.use("/api/public/works", publicWorksRoutes);
app.use("/api/public/animations", publicAnimationsRoutes);
app.use("/api/public/homepage", publicHomepageRoutes);
app.use("/api/public/pages", publicPagesRoutes);
app.use("/api/public/photography", publicPhotographyRoutes);
app.use("/api/public/photographers", publicPhotographersRoutes);
app.use("/api/public/photo-categories", publicPhotoCategoriesRoutes);
app.use("/api/public/navbar", publicNavbarRoutes);
app.use("/api/public/directors", publicDirectorsRoutes);
app.use("/api/public/directors-page", publicDirectorsPageRoutes);
app.use("/api/public/page-seo", publicPageSeoRoutes);
app.use("/api/public/settings", publicSettingsRoutes);
app.use("/api/public/presentations", publicPresentationRoutes);
// block-pages public route removed - works endpoint serves block data directly

// Ops/utility routes (guarded inside route)
app.use("/api/utils/revalidate", utilsRevalidateRoute);

// Webhook routes (no auth, validated by SNS signature)
app.use("/webhooks/mediaconvert", mediaConvertWebhook);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, async () => {
	console.log(`🚀 Server running on port ${PORT}`);
	console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
	console.log(`🔗 Health check: ${API_URL}/health`);
	console.log(`🔐 Auth endpoints: ${API_URL}/api/auth`);
	console.log(`📊 Dashboard endpoints: ${API_URL}/api/dashboard`);

	// Initialize database connection
	try {
		await database.connect();
	} catch (error) {
		console.error("Failed to connect to database:", error);
		process.exit(1);
	}

	// Schedule daily cleanup of original video files (runs at 3:00 AM)
	cron.schedule("0 3 * * *", async () => {
		console.log("[Cron] Starting scheduled media cleanup...");
		try {
			const result = await mediaCleanupService.runCleanup({
				batchSize: 50, // Process 50 files per run
				dryRun: false,
			});
			console.log(`[Cron] Media cleanup complete. Deleted: ${result.totalDeleted}, Errors: ${result.totalErrors}`);
		} catch (error) {
			console.error("[Cron] Media cleanup failed:", error);
		}
	});
	console.log("⏰ Scheduled media cleanup job (daily at 3:00 AM)");

	// Start clip sync service (runs every 2 minutes)
	startClipSyncService(2 * 60 * 1000);
	console.log("⏰ Started clip sync background service (every 2 minutes)");
});
