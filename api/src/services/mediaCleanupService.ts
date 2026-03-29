import { prisma } from "../config/database";
import { s3Service } from "./s3Service";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";

export interface CleanupResult {
	totalProcessed: number;
	totalDeleted: number;
	totalSkipped: number;
	totalErrors: number;
	deletedFiles: Array<{
		id: number;
		uuid: string;
		filename: string;
		processedAt: Date;
	}>;
	errors: Array<{
		id: number;
		uuid: string;
		error: string;
	}>;
}

export interface CleanupOptions {
	dryRun?: boolean;
	batchSize?: number;
	retentionDays?: number;
}

/**
 * Media Cleanup Service
 * Handles deletion of original video files after processing
 */
export class MediaCleanupService {
	/**
	 * Find all media files eligible for original deletion
	 * Criteria:
	 * - processingStatus = 'completed'
	 * - processingCompletedAt is older than retention period
	 * - originalDeletedAt is null (not already deleted)
	 * - File is a video (has optimizedVideoUrl or hlsUrl)
	 */
	async findEligibleFiles(options: CleanupOptions = {}): Promise<
		Array<{
			id: number;
			uuid: string;
			filename: string;
			processingCompletedAt: Date;
		}>
	> {
		const retentionDays = options.retentionDays ?? VIDEO_PROCESSING_CONFIG.retention.originalRetentionDays;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

		const files = await prisma.mediaFile.findMany({
			where: {
				processingStatus: "completed",
				processingCompletedAt: {
					lt: cutoffDate,
				},
				originalDeletedAt: null,
				// Must have optimized content
				OR: [{ optimizedVideoUrl: { not: null } }, { hlsUrl: { not: null } }],
				// Not soft-deleted
				deletedAt: null,
				purgedAt: null,
			},
			select: {
				id: true,
				uuid: true,
				filename: true,
				processingCompletedAt: true,
			},
			take: options.batchSize ?? 100,
			orderBy: {
				processingCompletedAt: "asc",
			},
		});

		return files.map((f) => ({
			id: f.id,
			uuid: f.uuid,
			filename: f.filename,
			processingCompletedAt: f.processingCompletedAt!,
		}));
	}

	/**
	 * Delete original video file from S3
	 */
	async deleteOriginalFile(uuid: string): Promise<void> {
		// The uuid is the S3 key (format: uuid/filename.mp4)
		await s3Service.deleteFile(uuid);
	}

	/**
	 * Mark file as having original deleted in database
	 */
	async markOriginalDeleted(mediaFileId: number): Promise<void> {
		await prisma.mediaFile.update({
			where: { id: mediaFileId },
			data: {
				originalDeletedAt: new Date(),
			},
		});
	}

	/**
	 * Run cleanup process
	 */
	async runCleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
		const dryRun = options.dryRun ?? false;
		const result: CleanupResult = {
			totalProcessed: 0,
			totalDeleted: 0,
			totalSkipped: 0,
			totalErrors: 0,
			deletedFiles: [],
			errors: [],
		};

		console.log(`[MediaCleanup] Starting cleanup (dryRun: ${dryRun})`);

		const eligibleFiles = await this.findEligibleFiles(options);
		result.totalProcessed = eligibleFiles.length;

		console.log(`[MediaCleanup] Found ${eligibleFiles.length} files eligible for cleanup`);

		for (const file of eligibleFiles) {
			try {
				if (dryRun) {
					console.log(
						`[MediaCleanup] [DRY-RUN] Would delete: ${
							file.uuid
						} (processed: ${file.processingCompletedAt.toISOString()})`
					);
					result.deletedFiles.push({
						id: file.id,
						uuid: file.uuid,
						filename: file.filename,
						processedAt: file.processingCompletedAt,
					});
					result.totalDeleted++;
				} else {
					// Actually delete from S3
					await this.deleteOriginalFile(file.uuid);
					// Mark as deleted in database
					await this.markOriginalDeleted(file.id);

					console.log(`[MediaCleanup] Deleted original: ${file.uuid}`);
					result.deletedFiles.push({
						id: file.id,
						uuid: file.uuid,
						filename: file.filename,
						processedAt: file.processingCompletedAt,
					});
					result.totalDeleted++;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error(`[MediaCleanup] Error deleting ${file.uuid}:`, errorMessage);
				result.errors.push({
					id: file.id,
					uuid: file.uuid,
					error: errorMessage,
				});
				result.totalErrors++;
			}
		}

		console.log(`[MediaCleanup] Cleanup complete. Deleted: ${result.totalDeleted}, Errors: ${result.totalErrors}`);
		return result;
	}

	/**
	 * Get cleanup statistics
	 */
	async getStats(): Promise<{
		pendingCleanup: number;
		alreadyCleaned: number;
		processingCompleted: number;
		processingPending: number;
		processingFailed: number;
	}> {
		const retentionDays = VIDEO_PROCESSING_CONFIG.retention.originalRetentionDays;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

		const [pendingCleanup, alreadyCleaned, processingCompleted, processingPending, processingFailed] =
			await Promise.all([
				// Files pending cleanup (eligible for deletion)
				prisma.mediaFile.count({
					where: {
						processingStatus: "completed",
						processingCompletedAt: { lt: cutoffDate },
						originalDeletedAt: null,
						OR: [{ optimizedVideoUrl: { not: null } }, { hlsUrl: { not: null } }],
						deletedAt: null,
						purgedAt: null,
					},
				}),
				// Files already cleaned up
				prisma.mediaFile.count({
					where: {
						originalDeletedAt: { not: null },
					},
				}),
				// Total completed processing
				prisma.mediaFile.count({
					where: { processingStatus: "completed" },
				}),
				// Pending processing
				prisma.mediaFile.count({
					where: {
						processingStatus: { in: ["pending", "processing"] },
					},
				}),
				// Failed processing
				prisma.mediaFile.count({
					where: { processingStatus: "failed" },
				}),
			]);

		return {
			pendingCleanup,
			alreadyCleaned,
			processingCompleted,
			processingPending,
			processingFailed,
		};
	}
}

export const mediaCleanupService = new MediaCleanupService();
