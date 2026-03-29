/**
 * Script to generate thumbnails for existing videos without thumbnails
 *
 * This script finds all video files in the database that don't have a thumbnailPath
 * and triggers MediaConvert processing to generate thumbnails.
 *
 * Usage:
 *   npx ts-node scripts/generateMissingThumbnails.ts [--dry-run] [--limit N]
 *
 * Options:
 *   --dry-run   Don't actually start processing, just show what would be done
 *   --limit N   Only process N videos (useful for testing)
 */

import { config } from "dotenv";
config(); // Load .env before other imports

import { PrismaClient } from "@prisma/client";
import { videoProcessingService } from "../src/services/videoProcessingService";
import { isProcessableVideo, VideoProcessingStatus, VIDEO_PROCESSING_CONFIG } from "../src/config/videoProcessing";

const prisma = new PrismaClient();

// Debug: Show which config values are set
function debugConfig() {
	console.log("🔧 Config Debug:");
	console.log(`   VIDEO_PROCESSING_ENABLED: ${process.env.VIDEO_PROCESSING_ENABLED}`);
	console.log(`   AWS_MEDIACONVERT_ENDPOINT: ${process.env.AWS_MEDIACONVERT_ENDPOINT ? "✓ set" : "❌ missing"}`);
	console.log(`   AWS_MEDIACONVERT_ROLE: ${process.env.AWS_MEDIACONVERT_ROLE ? "✓ set" : "❌ missing"}`);
	console.log(`   AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET ? "✓ set" : "❌ missing"}`);
	console.log(`   AWS_SNS_MEDIACONVERT_TOPIC: ${process.env.AWS_SNS_MEDIACONVERT_TOPIC ? "✓ set" : "❌ missing"}`);
	console.log(`   Config object enabled: ${VIDEO_PROCESSING_CONFIG.enabled}`);
	console.log(`   Config endpoint: ${VIDEO_PROCESSING_CONFIG.mediaConvert.endpoint ? "✓ set" : "❌ missing"}`);
	console.log(`   Config role: ${VIDEO_PROCESSING_CONFIG.mediaConvert.role ? "✓ set" : "❌ missing"}`);
	console.log(`   Config bucket: ${VIDEO_PROCESSING_CONFIG.s3.bucket ? "✓ set" : "❌ missing"}`);
	console.log(`   Config SNS: ${VIDEO_PROCESSING_CONFIG.sns.topicArn ? "✓ set" : "❌ missing"}`);
	console.log("");
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const resetAll = args.includes("--reset");
	const limitIndex = args.indexOf("--limit");
	const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

	debugConfig(); // Show config status

	// Reset mode: Clear all video thumbnailPath values
	if (resetAll) {
		console.log("🗑️  RESET MODE: Clearing all video thumbnailPath values...\n");

		// First show what will be reset
		const videosWithThumbnails = await prisma.mediaFile.findMany({
			where: {
				mimeType: { startsWith: "video/" },
				thumbnailPath: { not: null },
				deletedAt: null,
				purgedAt: null,
			},
			select: {
				id: true,
				originalName: true,
				thumbnailPath: true,
			},
		});

		console.log(`Found ${videosWithThumbnails.length} videos with thumbnailPath set:\n`);
		for (const video of videosWithThumbnails.slice(0, 10)) {
			console.log(`   [${video.id}] ${video.originalName}`);
			console.log(`       Path: ${video.thumbnailPath}`);
		}
		if (videosWithThumbnails.length > 10) {
			console.log(`   ... and ${videosWithThumbnails.length - 10} more`);
		}
		console.log("");

		if (dryRun) {
			console.log("🔍 DRY RUN - Would reset thumbnailPath for all these videos.");
			console.log("Run with --reset (without --dry-run) to actually reset.");
			return;
		}

		// Reset thumbnailPath and processingStatus for all videos
		const result = await prisma.mediaFile.updateMany({
			where: {
				mimeType: { startsWith: "video/" },
				deletedAt: null,
				purgedAt: null,
			},
			data: {
				thumbnailPath: null,
				processingStatus: null,
				processingJobId: null,
				processingStartedAt: null,
				processingCompletedAt: null,
			},
		});

		console.log(`✅ Reset ${result.count} videos. Run without --reset to regenerate thumbnails.`);
		return;
	}

	console.log("🎬 Finding videos without thumbnails...\n");

	// Find all video files without thumbnailPath
	const videosWithoutThumbnails = await prisma.mediaFile.findMany({
		where: {
			mimeType: {
				startsWith: "video/",
			},
			thumbnailPath: null,
			deletedAt: null,
			purgedAt: null,
		},
		select: {
			id: true,
			uuid: true,
			originalName: true,
			mimeType: true,
			processingStatus: true,
			size: true,
		},
		take: limit,
		orderBy: {
			createdAt: "desc",
		},
	});

	console.log(`Found ${videosWithoutThumbnails.length} videos without thumbnails.\n`);

	if (videosWithoutThumbnails.length === 0) {
		console.log("✅ All videos have thumbnails!");
		return;
	}

	// Categorize videos
	const processable: typeof videosWithoutThumbnails = [];
	const alreadyProcessing: typeof videosWithoutThumbnails = [];
	const alreadyCompleted: typeof videosWithoutThumbnails = [];
	const notProcessable: typeof videosWithoutThumbnails = [];

	for (const video of videosWithoutThumbnails) {
		if (!isProcessableVideo(video.mimeType)) {
			notProcessable.push(video);
		} else if (video.processingStatus === VideoProcessingStatus.PROCESSING) {
			alreadyProcessing.push(video);
		} else if (video.processingStatus === VideoProcessingStatus.COMPLETED) {
			alreadyCompleted.push(video);
		} else {
			processable.push(video);
		}
	}

	console.log("📊 Summary:");
	console.log(`   - Ready to process: ${processable.length}`);
	console.log(`   - Already processing: ${alreadyProcessing.length}`);
	console.log(`   - Completed (missing thumb): ${alreadyCompleted.length}`);
	console.log(`   - Not processable: ${notProcessable.length}`);
	console.log("");

	if (alreadyCompleted.length > 0) {
		console.log("⚠️  Videos marked as completed but missing thumbnails:");
		for (const video of alreadyCompleted) {
			console.log(`   - [${video.id}] ${video.originalName}`);
		}
		console.log("   These need reprocessing to generate thumbnails.\n");
	}

	if (dryRun) {
		console.log("🔍 DRY RUN - Would process the following videos:\n");
		for (const video of processable) {
			const sizeMB = (Number(video.size) / (1024 * 1024)).toFixed(2);
			console.log(`   [${video.id}] ${video.originalName} (${sizeMB} MB)`);
		}
		console.log("\nRun without --dry-run to actually start processing.");
		return;
	}

	// Check if video processing is available
	if (!videoProcessingService.isAvailable()) {
		console.error("❌ Video processing is not configured. Check your environment variables.");
		process.exit(1);
	}

	// Process videos
	console.log("🚀 Starting video processing...\n");

	let successCount = 0;
	let errorCount = 0;

	// Also reprocess completed videos that are missing thumbnails
	const toProcess = [...processable, ...alreadyCompleted];

	for (const video of toProcess) {
		try {
			console.log(`Processing [${video.id}] ${video.originalName}...`);

			// Reset status for completed videos so they can be reprocessed
			if (video.processingStatus === VideoProcessingStatus.COMPLETED) {
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: {
						processingStatus: null,
						processingJobId: null,
						processingStartedAt: null,
						processingCompletedAt: null,
					},
				});
			}

			const jobId = await videoProcessingService.startProcessing(video.id);

			if (jobId) {
				console.log(`   ✓ Started job: ${jobId}`);
				successCount++;
			} else {
				console.log(`   ⚠ Skipped (file too small or invalid)`);
			}

			// Small delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 500));
		} catch (error: any) {
			console.error(`   ✗ Error: ${error.message}`);
			errorCount++;
		}
	}

	console.log("\n📈 Results:");
	console.log(`   - Successfully started: ${successCount}`);
	console.log(`   - Errors: ${errorCount}`);
	console.log(`   - Skipped: ${toProcess.length - successCount - errorCount}`);
	console.log("\n✅ Done! Thumbnails will be generated when processing completes.");
}

main()
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
