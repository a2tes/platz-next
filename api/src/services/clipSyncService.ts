/**
 * Clip Sync Service
 * Background service that periodically syncs stuck ClipJobs with their blocks
 * This is a fail-safe mechanism to handle cases where:
 * - Webhook failed to deliver
 * - Race condition caused MediaConvert to complete before DB had job ID
 * - Network issues prevented block update
 */

import { prisma } from "../config/database";
import { ClipJobStatus } from "@prisma/client";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";
import { ClipProcessingStatus } from "./clipProcessingService";

// Store for tracking sync interval
let syncInterval: NodeJS.Timeout | null = null;

/**
 * Sync completed ClipJobs to their corresponding blocks
 * Finds clips that are marked as COMPLETED but haven't been synced to blocks
 */
async function syncCompletedClips(): Promise<{ synced: number; errors: number }> {
	let synced = 0;
	let errors = 0;

	try {
		// Find completed clips for block context that may need syncing
		const completedClips = await prisma.clipJob.findMany({
			where: {
				status: ClipJobStatus.COMPLETED,
				contextType: "block",
				contextId: { not: null },
				outputPath: { not: null },
			},
			include: {
				sourceMedia: {
					select: {
						id: true,
						uuid: true,
					},
				},
			},
			take: 50, // Process in batches
		});

		if (completedClips.length === 0) {
			return { synced: 0, errors: 0 };
		}

		console.log(`[ClipSync] Checking ${completedClips.length} completed clips for sync`);

		for (const clip of completedClips) {
			if (!clip.contextId || !clip.outputPath) continue;

			try {
				// Get the block and check if it needs updating
				const block = await prisma.block.findUnique({
					where: { id: clip.contextId },
				});

				if (!block) {
					console.log(`[ClipSync] Block ${clip.contextId} not found for clip ${clip.id}`);
					continue;
				}

				const content = block.content as any;
				const items = content?.items || [];
				const slotIndex = clip.slotIndex ?? 0;

				if (slotIndex >= items.length || !items[slotIndex]) {
					// Slot doesn't exist - try to find by workId
					if (clip.workId) {
						const foundIndex = items.findIndex((item: any) => item?.workId === clip.workId);
						if (foundIndex === -1) {
							console.log(`[ClipSync] Work ${clip.workId} not found in block ${clip.contextId}`);
							continue;
						}
					} else {
						console.log(`[ClipSync] Slot ${slotIndex} not found in block ${clip.contextId}`);
						continue;
					}
				}

				const item = items[slotIndex];

				// Check if already synced
				if (item.processedVideo?.status === "completed" && item.processedVideo?.clipJobId === clip.id) {
					// Already synced
					continue;
				}

				// Build URLs
				const { cloudfront } = VIDEO_PROCESSING_CONFIG;
				const outputUrl = `https://${cloudfront.domain}/${clip.outputPath}`;
				const thumbnailUrl = clip.thumbnailPath ? `https://${cloudfront.domain}/${clip.thumbnailPath}` : undefined;

				// Update block content
				const newItems = [...items];
				newItems[slotIndex] = {
					...item,
					processedVideo: {
						status: "completed" as ClipProcessingStatus,
						url: outputUrl,
						thumbnailUrl,
						settingsHash: clip.settingsHash,
						clipJobId: clip.id,
						completedAt: clip.completedAt?.toISOString() || new Date().toISOString(),
						syncedByJob: true, // Mark that this was synced by background job
					},
				};

				await prisma.block.update({
					where: { id: block.id },
					data: {
						content: { ...content, items: newItems },
					},
				});

				console.log(`[ClipSync] Synced clip ${clip.id} to block ${block.id} slot ${slotIndex}`);
				synced++;
			} catch (error) {
				console.error(`[ClipSync] Error syncing clip ${clip.id}:`, error);
				errors++;
			}
		}
	} catch (error) {
		console.error("[ClipSync] Error in sync process:", error);
		errors++;
	}

	return { synced, errors };
}

/**
 * Check for stuck PROCESSING jobs and mark them as failed if they've been stuck too long
 */
async function cleanupStuckJobs(): Promise<{ cleaned: number }> {
	let cleaned = 0;

	try {
		// Find jobs stuck in PROCESSING for more than 30 minutes
		const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

		const stuckJobs = await prisma.clipJob.findMany({
			where: {
				status: ClipJobStatus.PROCESSING,
				startedAt: { lt: thirtyMinutesAgo },
			},
			take: 20,
		});

		if (stuckJobs.length === 0) {
			return { cleaned: 0 };
		}

		console.log(`[ClipSync] Found ${stuckJobs.length} stuck PROCESSING jobs`);

		for (const job of stuckJobs) {
			try {
				await prisma.clipJob.update({
					where: { id: job.id },
					data: {
						status: ClipJobStatus.FAILED,
						errorMessage: "Job stuck in PROCESSING state for too long (auto-failed by sync service)",
						completedAt: new Date(),
					},
				});

				console.log(`[ClipSync] Marked stuck job ${job.id} as FAILED`);
				cleaned++;
			} catch (error) {
				console.error(`[ClipSync] Error cleaning up stuck job ${job.id}:`, error);
			}
		}
	} catch (error) {
		console.error("[ClipSync] Error in cleanup process:", error);
	}

	return { cleaned };
}

/**
 * Run a full sync cycle
 */
export async function runSyncCycle(): Promise<void> {
	console.log("[ClipSync] Starting sync cycle...");

	const syncResult = await syncCompletedClips();
	const cleanupResult = await cleanupStuckJobs();

	console.log(
		`[ClipSync] Sync cycle complete. Synced: ${syncResult.synced}, Errors: ${syncResult.errors}, Cleaned: ${cleanupResult.cleaned}`,
	);
}

/**
 * Start the background sync service
 * Runs every 2 minutes by default
 */
export function startClipSyncService(intervalMs: number = 2 * 60 * 1000): void {
	if (syncInterval) {
		console.log("[ClipSync] Service already running");
		return;
	}

	console.log(`[ClipSync] Starting background sync service (interval: ${intervalMs / 1000}s)`);

	// Run immediately on start
	runSyncCycle().catch((err) => console.error("[ClipSync] Initial sync failed:", err));

	// Then run periodically
	syncInterval = setInterval(() => {
		runSyncCycle().catch((err) => console.error("[ClipSync] Scheduled sync failed:", err));
	}, intervalMs);
}

/**
 * Stop the background sync service
 */
export function stopClipSyncService(): void {
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
		console.log("[ClipSync] Background sync service stopped");
	}
}

/**
 * Check if sync service is running
 */
export function isClipSyncServiceRunning(): boolean {
	return syncInterval !== null;
}
