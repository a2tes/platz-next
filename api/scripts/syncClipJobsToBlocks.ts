/**
 * Script to sync completed ClipJobs to their corresponding blocks
 * This fixes blocks that have completed clip jobs but missing processedVideo data
 *
 * Run with: npx ts-node scripts/syncClipJobsToBlocks.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CloudFront domain - update if different
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "di8jtbc1rw6ys.cloudfront.net";

async function syncClipJobsToBlocks() {
	console.log("Starting ClipJob to Block sync...\n");

	// Find all completed clip jobs with block context
	const completedJobs = await prisma.clipJob.findMany({
		where: {
			status: "COMPLETED",
			contextType: "block",
			outputPath: { not: null },
		},
		orderBy: { completedAt: "desc" },
	});

	console.log(`Found ${completedJobs.length} completed clip jobs with block context\n`);

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	for (const job of completedJobs) {
		try {
			const block = await prisma.block.findUnique({
				where: { id: job.contextId },
			});

			if (!block) {
				console.log(`  [SKIP] Block ${job.contextId} not found for job ${job.id}`);
				skipped++;
				continue;
			}

			const content = block.content as any;
			const items = content?.items || [];
			const slotIndex = job.slotIndex || 0;

			if (slotIndex >= items.length || !items[slotIndex]) {
				console.log(`  [SKIP] Slot ${slotIndex} not found in block ${job.contextId} for job ${job.id}`);
				skipped++;
				continue;
			}

			const item = items[slotIndex];

			// Check if processedVideo already exists and is completed
			if (item.processedVideo?.status === "completed" && item.processedVideo?.url) {
				console.log(`  [SKIP] Block ${job.contextId} slot ${slotIndex} already has processedVideo`);
				skipped++;
				continue;
			}

			// Build URLs from paths
			const outputUrl = job.outputPath ? `https://${CLOUDFRONT_DOMAIN}/${job.outputPath}` : undefined;
			const thumbnailUrl = job.thumbnailPath ? `https://${CLOUDFRONT_DOMAIN}/${job.thumbnailPath}` : undefined;

			// Update item with processedVideo
			item.processedVideo = {
				status: "completed",
				url: outputUrl,
				thumbnailUrl: thumbnailUrl,
				settingsHash: job.settingsHash,
				clipJobId: job.id,
				completedAt: job.completedAt?.toISOString(),
			};

			// Save updated block
			await prisma.block.update({
				where: { id: block.id },
				data: {
					content: { ...content, items },
				},
			});

			console.log(`  [OK] Updated block ${job.contextId} slot ${slotIndex} with job ${job.id}`);
			console.log(`       URL: ${outputUrl}`);
			console.log(`       Thumbnail: ${thumbnailUrl}`);
			updated++;
		} catch (error) {
			console.error(`  [ERROR] Failed to process job ${job.id}:`, error);
			errors++;
		}
	}

	console.log("\n--- Summary ---");
	console.log(`Updated: ${updated}`);
	console.log(`Skipped: ${skipped}`);
	console.log(`Errors: ${errors}`);
	console.log("Done!");
}

syncClipJobsToBlocks()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
