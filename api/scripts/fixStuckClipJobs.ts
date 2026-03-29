/**
 * Script to fix stuck ClipJobs that are still in PROCESSING status
 * This checks AWS MediaConvert for actual job status and updates accordingly
 *
 * Run with: npx ts-node scripts/fixStuckClipJobs.ts
 */

import { PrismaClient } from "@prisma/client";
import { MediaConvertClient, GetJobCommand } from "@aws-sdk/client-mediaconvert";

const prisma = new PrismaClient();

// Configuration
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "di8jtbc1rw6ys.cloudfront.net";
const AWS_REGION = process.env.AWS_REGION || "eu-central-1";

const mediaConvertClient = new MediaConvertClient({
	region: AWS_REGION,
});

async function getMediaConvertJobStatus(jobId: string): Promise<{
	status: string;
	outputFilePaths?: string[];
	errorMessage?: string;
} | null> {
	try {
		const command = new GetJobCommand({ Id: jobId });
		const response = await mediaConvertClient.send(command);

		const job = response.Job;
		if (!job) return null;

		const outputFilePaths: string[] = [];
		if (job.OutputGroupDetails) {
			for (const group of job.OutputGroupDetails) {
				if (group.OutputDetails) {
					for (const output of group.OutputDetails) {
						// AWS SDK uses different property names - check for both
						const paths = (output as any).OutputFilePaths || (output as any).outputFilePaths;
						if (paths) {
							outputFilePaths.push(...paths);
						}
					}
				}
			}
		}

		return {
			status: job.Status || "UNKNOWN",
			outputFilePaths,
			errorMessage: job.ErrorMessage,
		};
	} catch (error: any) {
		console.error(`  Failed to get MediaConvert job ${jobId}:`, error.message);
		return null;
	}
}

async function fixStuckClipJobs() {
	console.log("Finding stuck ClipJobs (PENDING or PROCESSING status)...\n");

	// Find all stuck clip jobs
	const stuckJobs = await prisma.clipJob.findMany({
		where: {
			status: { in: ["PENDING", "PROCESSING"] },
		},
		orderBy: { createdAt: "desc" },
	});

	console.log(`Found ${stuckJobs.length} stuck clip jobs\n`);

	if (stuckJobs.length === 0) {
		console.log("No stuck jobs found!");
		return;
	}

	let completed = 0;
	let failed = 0;
	let stillProcessing = 0;
	let noMediaConvertJob = 0;

	for (const job of stuckJobs) {
		console.log(`\nProcessing ClipJob ${job.id}:`);
		console.log(`  MediaConvert Job ID: ${job.mediaConvertJobId || "N/A"}`);
		console.log(`  Block ID: ${job.contextId}, Slot: ${job.slotIndex}`);
		console.log(`  Created: ${job.createdAt}`);

		if (!job.mediaConvertJobId) {
			console.log(`  [SKIP] No MediaConvert job ID - marking as FAILED`);
			await prisma.clipJob.update({
				where: { id: job.id },
				data: { status: "FAILED", errorMessage: "No MediaConvert job ID" },
			});
			noMediaConvertJob++;
			continue;
		}

		// Check MediaConvert status
		const mcStatus = await getMediaConvertJobStatus(job.mediaConvertJobId);

		if (!mcStatus) {
			console.log(`  [WARN] Could not fetch MediaConvert job status`);
			continue;
		}

		console.log(`  MediaConvert Status: ${mcStatus.status}`);

		if (mcStatus.status === "COMPLETE") {
			// Use the output path from our database (set when job was created)
			// MediaConvert SDK doesn't return output paths in GetJob response
			const relativePath = job.outputPath;

			if (relativePath) {
				const thumbnailPath = relativePath.replace(/\.mp4$/, ".0000000.jpg");

				console.log(`  Output Path: ${relativePath}`);
				console.log(`  Thumbnail Path: ${thumbnailPath}`);

				// Update ClipJob
				await prisma.clipJob.update({
					where: { id: job.id },
					data: {
						status: "COMPLETED",
						outputPath: relativePath,
						thumbnailPath: thumbnailPath,
						completedAt: new Date(),
					},
				});

				// Update block content
				if (job.contextType === "block") {
					const block = await prisma.block.findUnique({
						where: { id: job.contextId },
					});

					if (block) {
						const content = block.content as any;
						const items = content?.items || [];
						const slotIndex = job.slotIndex || 0;

						if (slotIndex < items.length && items[slotIndex]) {
							const outputUrl = `https://${CLOUDFRONT_DOMAIN}/${relativePath}`;
							const thumbnailUrl = `https://${CLOUDFRONT_DOMAIN}/${thumbnailPath}`;

							items[slotIndex].processedVideo = {
								status: "completed",
								url: outputUrl,
								thumbnailUrl: thumbnailUrl,
								settingsHash: job.settingsHash,
								clipJobId: job.id,
								completedAt: new Date().toISOString(),
							};

							await prisma.block.update({
								where: { id: block.id },
								data: { content: { ...content, items } },
							});

							console.log(`  [OK] Updated ClipJob and Block`);
							console.log(`       Video URL: ${outputUrl}`);
						} else {
							console.log(`  [WARN] Slot ${slotIndex} not found in block`);
						}
					} else {
						console.log(`  [WARN] Block ${job.contextId} not found`);
					}
				}

				completed++;
			} else {
				console.log(`  [WARN] No output path in database for job ${job.id}`);
			}
		} else if (mcStatus.status === "ERROR") {
			console.log(`  [FAIL] MediaConvert job failed: ${mcStatus.errorMessage}`);

			await prisma.clipJob.update({
				where: { id: job.id },
				data: {
					status: "FAILED",
					errorMessage: mcStatus.errorMessage || "MediaConvert job failed",
				},
			});

			// Update block with failure
			if (job.contextType === "block") {
				const block = await prisma.block.findUnique({
					where: { id: job.contextId },
				});

				if (block) {
					const content = block.content as any;
					const items = content?.items || [];
					const slotIndex = job.slotIndex || 0;

					if (slotIndex < items.length && items[slotIndex]) {
						items[slotIndex].processedVideo = {
							status: "failed",
							error: mcStatus.errorMessage || "MediaConvert job failed",
							settingsHash: job.settingsHash,
							clipJobId: job.id,
						};

						await prisma.block.update({
							where: { id: block.id },
							data: { content: { ...content, items } },
						});
					}
				}
			}

			failed++;
		} else if (mcStatus.status === "PROGRESSING") {
			console.log(`  [INFO] Still processing in MediaConvert`);
			stillProcessing++;
		} else {
			console.log(`  [INFO] Unknown status: ${mcStatus.status}`);
		}
	}

	console.log("\n\n--- Summary ---");
	console.log(`Completed: ${completed}`);
	console.log(`Failed: ${failed}`);
	console.log(`Still Processing: ${stillProcessing}`);
	console.log(`No MediaConvert Job: ${noMediaConvertJob}`);
}

fixStuckClipJobs()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
