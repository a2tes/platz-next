/**
 * Fix Video URLs Script
 *
 * This script fixes the optimized video URLs that were incorrectly generated
 * using UUID instead of the original filename.
 *
 * MediaConvert output naming uses the original filename, not UUID:
 * - Wrong: optimized/{uuid}/mp4/{uuid}_1080p.mp4
 * - Correct: optimized/{uuid}/mp4/{originalFilename}_1080p.mp4
 *
 * Usage: npx ts-node scripts/fixVideoUrls.ts [--dry-run]
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Get CloudFront domain from environment or use default
const CLOUDFRONT_DOMAIN = process.env.VIDEO_CLOUDFRONT_DOMAIN || "di8jtbc1rw6ys.cloudfront.net";
const OUTPUT_PREFIX = "optimized";

async function fixVideoUrls(dryRun: boolean = false) {
	console.log(`\n🔧 Fix Video URLs Script`);
	console.log(`   CloudFront: ${CLOUDFRONT_DOMAIN}`);
	console.log(`   Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}\n`);

	// Find all videos with completed processing
	const videos = await prisma.mediaFile.findMany({
		where: {
			mimeType: { startsWith: "video/" },
			processingStatus: "completed",
		},
		select: {
			id: true,
			uuid: true,
			filename: true,
			hlsUrl: true,
			optimizedVideoUrl: true,
			optimizedUrls: true,
		},
	});

	console.log(`Found ${videos.length} processed videos\n`);

	let fixedCount = 0;
	let skippedCount = 0;
	let errorCount = 0;

	for (const video of videos) {
		try {
			// Parse uuid - format: "uuid/filename.mp4"
			const uuidParts = video.uuid.split("/");
			const uuidPart = uuidParts[0];

			// Extract original filename (without extension)
			const originalFilename = uuidParts.length > 1 ? uuidParts[1].replace(/\.[^/.]+$/, "") : null;

			if (!originalFilename) {
				console.log(`⚠️  [${video.id}] Skipping - uuid doesn't contain filename: ${video.uuid}`);
				skippedCount++;
				continue;
			}

			// Build correct URLs
			const correctOptimizedUrls = {
				"1080p": `https://${CLOUDFRONT_DOMAIN}/${OUTPUT_PREFIX}/${uuidPart}/mp4/${originalFilename}_1080p.mp4`,
				"720p": `https://${CLOUDFRONT_DOMAIN}/${OUTPUT_PREFIX}/${uuidPart}/mp4/${originalFilename}_720p.mp4`,
				"480p": `https://${CLOUDFRONT_DOMAIN}/${OUTPUT_PREFIX}/${uuidPart}/mp4/${originalFilename}_480p.mp4`,
			} as Prisma.InputJsonValue;
			const correctHlsUrl = `https://${CLOUDFRONT_DOMAIN}/${OUTPUT_PREFIX}/${uuidPart}/hls/${originalFilename}.m3u8`;
			const correct1080pUrl = `https://${CLOUDFRONT_DOMAIN}/${OUTPUT_PREFIX}/${uuidPart}/mp4/${originalFilename}_1080p.mp4`;

			// Check if URLs are already correct
			if (video.hlsUrl === correctHlsUrl && video.optimizedVideoUrl === correct1080pUrl) {
				console.log(`✓  [${video.id}] Already correct: ${video.filename}`);
				skippedCount++;
				continue;
			}

			// Show what will change
			console.log(`\n📝 [${video.id}] ${video.filename}`);
			console.log(`   UUID: ${video.uuid}`);
			console.log(`   Original filename: ${originalFilename}`);

			if (video.hlsUrl !== correctHlsUrl) {
				console.log(`   HLS URL:`);
				console.log(`     Old: ${video.hlsUrl}`);
				console.log(`     New: ${correctHlsUrl}`);
			}

			if (video.optimizedVideoUrl !== correct1080pUrl) {
				console.log(`   Optimized URL:`);
				console.log(`     Old: ${video.optimizedVideoUrl}`);
				console.log(`     New: ${correct1080pUrl}`);
			}

			if (!dryRun) {
				await prisma.mediaFile.update({
					where: { id: video.id },
					data: {
						hlsUrl: correctHlsUrl,
						optimizedVideoUrl: correct1080pUrl,
						optimizedUrls: correctOptimizedUrls,
					},
				});
				console.log(`   ✅ Updated!`);
			} else {
				console.log(`   ⏸️  Would update (dry run)`);
			}

			fixedCount++;
		} catch (error) {
			console.error(`❌ [${video.id}] Error:`, error);
			errorCount++;
		}
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log(`Summary:`);
	console.log(`  Total videos: ${videos.length}`);
	console.log(`  Fixed: ${fixedCount}`);
	console.log(`  Skipped (already correct or no filename): ${skippedCount}`);
	console.log(`  Errors: ${errorCount}`);

	if (dryRun && fixedCount > 0) {
		console.log(`\n💡 Run without --dry-run to apply changes`);
	}
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

fixVideoUrls(dryRun)
	.catch((error) => {
		console.error("Script failed:", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
