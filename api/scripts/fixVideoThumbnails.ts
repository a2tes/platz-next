/**
 * Fix Video Thumbnails & Pending Statuses
 *
 * This script:
 * 1. Fixes stuck "pending" statuses for non-processable or too-small videos
 * 2. Generates thumbnails for videos that don't have them
 * 3. Reprocesses "completed" videos that are missing thumbnails
 * 4. Resets "failed" videos so they can be retried
 *
 * Usage:
 *   npx ts-node scripts/fixVideoThumbnails.ts [--dry-run] [--limit N] [--fix-pending-only]
 *
 * Options:
 *   --dry-run          Don't actually make changes, just show what would be done
 *   --limit N          Only process N videos (useful for testing)
 *   --fix-pending-only Only fix stuck pending statuses, don't trigger reprocessing
 */

import { config } from "dotenv";
config(); // Load .env before other imports

import { PrismaClient } from "@prisma/client";
import { videoProcessingService } from "../src/services/videoProcessingService";
import {
	isProcessableVideo,
	VideoProcessingStatus,
	VIDEO_PROCESSING_CONFIG,
	isVideoProcessingConfigured,
} from "../src/config/videoProcessing";

const prisma = new PrismaClient();

function debugConfig() {
	console.log("🔧 Config Debug:");
	console.log(`   VIDEO_PROCESSING_ENABLED: ${process.env.VIDEO_PROCESSING_ENABLED}`);
	console.log(`   AWS_MEDIACONVERT_ENDPOINT: ${process.env.AWS_MEDIACONVERT_ENDPOINT ? "✓ set" : "❌ missing"}`);
	console.log(`   AWS_MEDIACONVERT_ROLE: ${process.env.AWS_MEDIACONVERT_ROLE ? "✓ set" : "❌ missing"}`);
	console.log(`   AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET ? "✓ set" : "❌ missing"}`);
	console.log(`   AWS_ACCOUNT_ID: ${process.env.AWS_ACCOUNT_ID ? "✓ set" : "❌ missing"}`);
	console.log(`   Config enabled: ${VIDEO_PROCESSING_CONFIG.enabled}`);
	console.log("");
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const fixPendingOnly = args.includes("--fix-pending-only");
	const limitIndex = args.indexOf("--limit");
	const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

	debugConfig();

	console.log("🎬 Scanning all video files...\n");

	// Get ALL video files (not deleted/purged)
	const allVideos = await prisma.mediaFile.findMany({
		where: {
			mimeType: { startsWith: "video/" },
			deletedAt: null,
			purgedAt: null,
		},
		select: {
			id: true,
			uuid: true,
			originalName: true,
			mimeType: true,
			size: true,
			processingStatus: true,
			processingJobId: true,
			thumbnailPath: true,
			createdAt: true,
		},
		orderBy: { createdAt: "desc" },
	});

	console.log(`Found ${allVideos.length} total video files.\n`);

	// Categorize all videos
	const stuckPending: typeof allVideos = []; // pending but no job ID, or pending too long
	const stuckProcessing: typeof allVideos = []; // processing but stale (> 1 hour)
	const failedVideos: typeof allVideos = []; // failed status
	const completedNoThumb: typeof allVideos = []; // completed but missing thumbnail
	const noStatusNoThumb: typeof allVideos = []; // null status but no thumbnail (never processed)
	const nonProcessable: typeof allVideos = []; // non-processable mime types with pending/processing status
	const ok: typeof allVideos = []; // everything fine

	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

	for (const video of allVideos) {
		const processable = isProcessableVideo(video.mimeType);

		// Non-processable videos with a processing status → fix
		if (!processable && video.processingStatus) {
			nonProcessable.push(video);
			continue;
		}

		// Has thumbnail → OK
		if (video.thumbnailPath) {
			ok.push(video);
			continue;
		}

		// No thumbnail from here on
		switch (video.processingStatus) {
			case "pending":
				stuckPending.push(video);
				break;
			case "processing":
				// If processing started more than 1 hour ago, consider it stuck
				stuckProcessing.push(video);
				break;
			case "failed":
				failedVideos.push(video);
				break;
			case "completed":
				completedNoThumb.push(video);
				break;
			default:
				// null status and no thumbnail
				if (processable) {
					noStatusNoThumb.push(video);
				}
				break;
		}
	}

	console.log("📊 Video Analysis:");
	console.log(`   ✅ OK (has thumbnail):              ${ok.length}`);
	console.log(`   ⏳ Stuck "pending":                  ${stuckPending.length}`);
	console.log(`   ⏳ Stuck "processing" (stale):       ${stuckProcessing.length}`);
	console.log(`   ❌ Failed:                           ${failedVideos.length}`);
	console.log(`   ⚠️  Completed but missing thumbnail: ${completedNoThumb.length}`);
	console.log(`   🔘 Never processed (no thumbnail):   ${noStatusNoThumb.length}`);
	console.log(`   🚫 Non-processable with status:      ${nonProcessable.length}`);
	console.log("");

	// ────────────────────────────────────────────────────────────
	// STEP 1: Fix non-processable videos with stuck statuses
	// ────────────────────────────────────────────────────────────
	if (nonProcessable.length > 0) {
		console.log("🔧 Step 1: Fixing non-processable videos with stuck statuses...");
		for (const video of nonProcessable) {
			console.log(`   [${video.id}] ${video.originalName} (${video.mimeType}) — was "${video.processingStatus}"`);
			if (!dryRun) {
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: {
						processingStatus: null,
						processingJobId: null,
						processingError: null,
						processingStartedAt: null,
						processingCompletedAt: null,
					},
				});
			}
		}
		console.log(`   ${dryRun ? "Would fix" : "Fixed"} ${nonProcessable.length} non-processable videos.\n`);
	}

	// ────────────────────────────────────────────────────────────
	// STEP 2: Fix stuck pending/processing videos
	// ────────────────────────────────────────────────────────────
	const stuckVideos = [...stuckPending, ...stuckProcessing];
	if (stuckVideos.length > 0) {
		console.log("🔧 Step 2: Resetting stuck pending/processing videos...");
		for (const video of stuckVideos) {
			console.log(`   [${video.id}] ${video.originalName} — was "${video.processingStatus}"`);
			if (!dryRun) {
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: {
						processingStatus: null,
						processingJobId: null,
						processingError: null,
						processingStartedAt: null,
						processingCompletedAt: null,
					},
				});
			}
		}
		console.log(`   ${dryRun ? "Would reset" : "Reset"} ${stuckVideos.length} stuck videos.\n`);
	}

	// ────────────────────────────────────────────────────────────
	// STEP 3: Fix failed videos
	// ────────────────────────────────────────────────────────────
	if (failedVideos.length > 0) {
		console.log("🔧 Step 3: Resetting failed videos...");
		for (const video of failedVideos) {
			console.log(`   [${video.id}] ${video.originalName} — failed`);
			if (!dryRun) {
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: {
						processingStatus: null,
						processingJobId: null,
						processingError: null,
						processingStartedAt: null,
						processingCompletedAt: null,
					},
				});
			}
		}
		console.log(`   ${dryRun ? "Would reset" : "Reset"} ${failedVideos.length} failed videos.\n`);
	}

	// ────────────────────────────────────────────────────────────
	// STEP 4: Fix completed videos missing thumbnails
	// ────────────────────────────────────────────────────────────
	if (completedNoThumb.length > 0) {
		console.log("🔧 Step 4: Resetting completed videos missing thumbnails...");
		for (const video of completedNoThumb) {
			console.log(`   [${video.id}] ${video.originalName}`);
			if (!dryRun) {
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: {
						processingStatus: null,
						processingJobId: null,
						processingError: null,
						processingStartedAt: null,
						processingCompletedAt: null,
					},
				});
			}
		}
		console.log(
			`   ${dryRun ? "Would reset" : "Reset"} ${completedNoThumb.length} completed videos without thumbnails.\n`,
		);
	}

	if (fixPendingOnly) {
		console.log("✅ Pending fix mode complete. Run without --fix-pending-only to also trigger processing.\n");
		return;
	}

	// ────────────────────────────────────────────────────────────
	// STEP 5: Trigger processing for all videos without thumbnails
	// ────────────────────────────────────────────────────────────
	// Combine all videos that need reprocessing (now with null status after reset)
	const needsProcessing = [
		...stuckPending,
		...stuckProcessing,
		...failedVideos,
		...completedNoThumb,
		...noStatusNoThumb,
	];

	if (needsProcessing.length === 0) {
		console.log("✅ All videos have thumbnails! Nothing to process.\n");
		return;
	}

	// Apply limit
	const toProcess = limit ? needsProcessing.slice(0, limit) : needsProcessing;

	console.log(`🚀 Step 5: Triggering processing for ${toProcess.length} videos...\n`);

	if (dryRun) {
		for (const video of toProcess) {
			const sizeMB = (Number(video.size) / (1024 * 1024)).toFixed(2);
			console.log(`   [${video.id}] ${video.originalName} (${sizeMB} MB, ${video.mimeType})`);
		}
		console.log(`\n🔍 DRY RUN — Would process ${toProcess.length} videos. Run without --dry-run to execute.`);
		return;
	}

	// Check if video processing is available
	if (!videoProcessingService.isAvailable()) {
		console.error("❌ Video processing is not configured. Check your environment variables.");
		console.log("   You can still use --fix-pending-only to just fix stuck statuses.");
		process.exit(1);
	}

	let successCount = 0;
	let errorCount = 0;
	let skippedCount = 0;

	for (let i = 0; i < toProcess.length; i++) {
		const video = toProcess[i];
		const sizeMB = (Number(video.size) / (1024 * 1024)).toFixed(2);

		try {
			process.stdout.write(`   [${i + 1}/${toProcess.length}] ${video.originalName} (${sizeMB} MB)... `);

			const jobId = await videoProcessingService.startProcessing(video.id);

			if (jobId) {
				console.log(`✓ Job: ${jobId}`);
				successCount++;
			} else {
				console.log("⊘ Skipped (not processable)");
				skippedCount++;
				// Clear pending status if it was set
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: { processingStatus: null },
				});
			}

			// Small delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 500));
		} catch (error: any) {
			console.log(`✗ Error: ${error.message}`);
			errorCount++;
		}
	}

	console.log("\n📈 Results:");
	console.log(`   ✓ Successfully started: ${successCount}`);
	console.log(`   ⊘ Skipped:              ${skippedCount}`);
	console.log(`   ✗ Errors:               ${errorCount}`);
	console.log("\n✅ Done! Thumbnails will be generated as MediaConvert jobs complete.");
	console.log("   Use the SNS webhook or poll for status updates.\n");
}

main()
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
