/**
 * Clip Job Service
 * Manages video clip processing jobs (crop/trim) in the database
 */

import { ClipJobStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { createHash } from "crypto";

// ============================================
// TYPES
// ============================================

export interface CropSettings {
	x: number; // % (0-100)
	y: number; // % (0-100)
	width: number; // % (0-100)
	height: number; // % (0-100)
	aspect: number;
}

export interface TrimSettings {
	startTime: number; // seconds
	endTime: number; // seconds
}

export interface CreateClipJobParams {
	sourceMediaId: number;
	contextType?: string; // "block", "work", "animation", "director", etc. (optional for media library clips)
	contextId?: number; // optional for media library clips
	slotIndex?: number;
	workId?: number; // Work ID for verification during updates
	cropSettings?: CropSettings;
	trimSettings?: TrimSettings;
	maxDimension?: number;
	quality?: "high" | "medium" | "low";
	outputPath?: string;
	isDefault?: boolean; // true for default clip without crop/trim
	settingsHashOverride?: string; // Use this hash instead of computing from crop/trim (e.g. for thumbnail jobs with 't' suffix)
}

export interface OutputMetadata {
	width: number;
	height: number;
	duration: number;
	size: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a hash from crop and trim settings for deduplication
 */
function generateSettingsHash(cropSettings?: CropSettings, trimSettings?: TrimSettings): string {
	const data = JSON.stringify({
		crop: cropSettings
			? {
					x: Math.round(cropSettings.x * 100) / 100,
					y: Math.round(cropSettings.y * 100) / 100,
					width: Math.round(cropSettings.width * 100) / 100,
					height: Math.round(cropSettings.height * 100) / 100,
					aspect: Math.round(cropSettings.aspect * 1000) / 1000,
				}
			: null,
		trim: trimSettings
			? {
					startTime: Math.round(trimSettings.startTime * 100) / 100,
					endTime: Math.round(trimSettings.endTime * 100) / 100,
				}
			: null,
	});

	return createHash("md5").update(data).digest("hex").substring(0, 12);
}

// ============================================
// CLIP JOB SERVICE
// ============================================

export class ClipJobService {
	/**
	 * Get or create a clip job (deduplication by sourceMediaId + settingsHash)
	 * This is the primary method for creating clips - it will reuse existing clips when possible
	 */
	async getOrCreateClip(params: CreateClipJobParams) {
		const {
			sourceMediaId,
			contextType,
			contextId,
			slotIndex,
			workId,
			cropSettings,
			trimSettings,
			maxDimension = 1280,
			quality = "high",
			outputPath,
			isDefault = false,
			settingsHashOverride,
		} = params;

		// Generate settings hash for deduplication (use override if provided)
		const settingsHash = settingsHashOverride || generateSettingsHash(cropSettings, trimSettings);

		// Look for existing clip with same source + settings (regardless of context)
		// This enables clip reuse across different blocks/works
		const existingClip = await prisma.clipJob.findFirst({
			where: {
				sourceMediaId,
				settingsHash,
				status: {
					in: [ClipJobStatus.PENDING, ClipJobStatus.PROCESSING, ClipJobStatus.COMPLETED],
				},
			},
			orderBy: [
				// Prefer completed clips
				{ status: "asc" }, // COMPLETED = 2, PROCESSING = 1, PENDING = 0 (alphabetically: C < P < PR)
				{ createdAt: "desc" },
			],
		});

		if (existingClip) {
			// If completed, reuse it - just log the new context reference
			if (existingClip.status === ClipJobStatus.COMPLETED) {
				console.log(
					`[ClipJob] Reusing completed clip ${existingClip.id} (hash: ${settingsHash}) for ${contextType || "media-library"}:${contextId || "N/A"}`,
				);
				return {
					clip: existingClip,
					isNew: false,
					reused: true,
				};
			}
			// If pending/processing, return it (don't create duplicate processing job)
			console.log(`[ClipJob] Clip ${existingClip.id} already in progress (${existingClip.status}) for same settings`);
			return {
				clip: existingClip,
				isNew: false,
				reused: false,
			};
		}

		// Create new clip job
		const clip = await prisma.clipJob.create({
			data: {
				sourceMediaId,
				contextType: contextType || null,
				contextId: contextId || null,
				slotIndex: slotIndex ?? null,
				workId: workId || null,
				isDefault,
				cropSettings: cropSettings ? (cropSettings as unknown as Prisma.InputJsonValue) : undefined,
				trimSettings: trimSettings ? (trimSettings as unknown as Prisma.InputJsonValue) : undefined,
				settingsHash,
				maxDimension,
				quality,
				outputPath,
				status: ClipJobStatus.PENDING,
			},
		});

		console.log(
			`[ClipJob] Created new clip ${clip.id} (hash: ${settingsHash}) for ${contextType || "media-library"}:${contextId || "N/A"}`,
		);
		return {
			clip,
			isNew: true,
			reused: false,
		};
	}

	/**
	 * Create a new clip job (legacy method - prefer getOrCreateClip)
	 * Returns existing job if one with same settings already exists
	 */
	async createJob(params: CreateClipJobParams) {
		const {
			sourceMediaId,
			contextType,
			contextId,
			slotIndex,
			workId,
			cropSettings,
			trimSettings,
			maxDimension = 1280,
			quality = "high",
			outputPath,
			isDefault = false,
		} = params;

		// Generate settings hash
		const settingsHash = generateSettingsHash(cropSettings, trimSettings);

		// Check for existing job with same source and settings
		const existingJob = await prisma.clipJob.findFirst({
			where: {
				sourceMediaId,
				settingsHash,
				status: {
					in: [ClipJobStatus.PENDING, ClipJobStatus.PROCESSING, ClipJobStatus.COMPLETED],
				},
			},
		});

		if (existingJob) {
			// If completed, we can reuse it
			if (existingJob.status === ClipJobStatus.COMPLETED) {
				console.log(`[ClipJob] Reusing completed job ${existingJob.id} for same settings`);
				return existingJob;
			}
			// If pending/processing, return it (don't create duplicate)
			console.log(`[ClipJob] Job ${existingJob.id} already exists with status ${existingJob.status}`);
			return existingJob;
		}

		// Create new job
		const job = await prisma.clipJob.create({
			data: {
				sourceMediaId,
				contextType: contextType || null,
				contextId: contextId || null,
				slotIndex: slotIndex ?? null,
				workId: workId || null,
				isDefault,
				cropSettings: cropSettings ? (cropSettings as unknown as Prisma.InputJsonValue) : undefined,
				trimSettings: trimSettings ? (trimSettings as unknown as Prisma.InputJsonValue) : undefined,
				settingsHash,
				maxDimension,
				quality,
				outputPath,
				status: ClipJobStatus.PENDING,
			},
		});

		console.log(`[ClipJob] Created new job ${job.id} for ${contextType || "media-library"}:${contextId || "N/A"}`);
		return job;
	}

	/**
	 * Get a clip job by ID
	 */
	async getJob(id: string) {
		return prisma.clipJob.findUnique({
			where: { id },
			include: {
				sourceMedia: {
					select: {
						id: true,
						uuid: true,
						optimizedUrls: true,
						metadata: true,
					},
				},
			},
		});
	}

	/**
	 * Get all clip jobs for a context
	 */
	async getJobsForContext(contextType: string, contextId: number) {
		return prisma.clipJob.findMany({
			where: { contextType, contextId },
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * Get pending jobs (for processing queue)
	 */
	async getPendingJobs(limit = 10) {
		return prisma.clipJob.findMany({
			where: { status: ClipJobStatus.PENDING },
			orderBy: { createdAt: "asc" },
			take: limit,
			include: {
				sourceMedia: {
					select: {
						id: true,
						uuid: true,
						optimizedUrls: true,
						metadata: true,
					},
				},
			},
		});
	}

	/**
	 * Mark job as processing
	 */
	async markProcessing(id: string, mediaConvertJobId: string) {
		return prisma.clipJob.update({
			where: { id },
			data: {
				status: ClipJobStatus.PROCESSING,
				mediaConvertJobId,
				startedAt: new Date(),
			},
		});
	}

	/**
	 * Update job progress
	 */
	async updateProgress(id: string, progress: number) {
		return prisma.clipJob.update({
			where: { id },
			data: { progress },
		});
	}

	/**
	 * Mark job as completed
	 * Note: URLs are built dynamically from paths - no need to store them
	 */
	async markCompleted(id: string, outputPath: string, thumbnailPath?: string, outputMetadata?: OutputMetadata) {
		return prisma.clipJob.update({
			where: { id },
			data: {
				status: ClipJobStatus.COMPLETED,
				outputPath,
				thumbnailPath: thumbnailPath || null,
				outputMetadata: outputMetadata ? (outputMetadata as unknown as Prisma.InputJsonValue) : undefined,
				progress: 100,
				completedAt: new Date(),
			},
		});
	}

	/**
	 * Mark job as failed
	 */
	async markFailed(id: string, errorMessage: string) {
		return prisma.clipJob.update({
			where: { id },
			data: {
				status: ClipJobStatus.FAILED,
				errorMessage,
				completedAt: new Date(),
			},
		});
	}

	/**
	 * Find job by MediaConvert job ID
	 */
	async findByMediaConvertJobId(mediaConvertJobId: string) {
		return prisma.clipJob.findFirst({
			where: { mediaConvertJobId },
			include: {
				sourceMedia: true,
				work: {
					select: {
						id: true,
						slug: true,
					},
				},
			},
		});
	}

	/**
	 * Find clip by settings hash and source media
	 * Returns the best available clip (completed > processing > pending)
	 */
	async findClipBySettings(sourceMediaId: number, cropSettings?: CropSettings, trimSettings?: TrimSettings) {
		const settingsHash = generateSettingsHash(cropSettings, trimSettings);

		return prisma.clipJob.findFirst({
			where: {
				sourceMediaId,
				settingsHash,
				status: {
					in: [ClipJobStatus.PENDING, ClipJobStatus.PROCESSING, ClipJobStatus.COMPLETED],
				},
			},
			orderBy: [
				// Prefer completed clips
				{ status: "asc" },
				{ createdAt: "desc" },
			],
			include: {
				sourceMedia: true,
			},
		});
	}

	/**
	 * Get job by settings hash and source media (legacy - prefer findClipBySettings)
	 * Useful for checking if we already have a processed clip
	 */
	async findCompletedBySettings(sourceMediaId: number, cropSettings?: CropSettings, trimSettings?: TrimSettings) {
		const settingsHash = generateSettingsHash(cropSettings, trimSettings);

		return prisma.clipJob.findFirst({
			where: {
				sourceMediaId,
				settingsHash,
				status: ClipJobStatus.COMPLETED,
			},
		});
	}

	/**
	 * Find all clips for a source media file
	 * Useful for showing available clips in media library
	 */
	async findClipsForMedia(sourceMediaId: number) {
		return prisma.clipJob.findMany({
			where: {
				sourceMediaId,
				status: ClipJobStatus.COMPLETED,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * Find clips by work ID
	 * Useful for getting all clips associated with a work
	 */
	async findClipsByWorkId(workId: number) {
		return prisma.clipJob.findMany({
			where: { workId },
			orderBy: { createdAt: "desc" },
			include: {
				sourceMedia: {
					select: {
						id: true,
						uuid: true,
						filename: true,
					},
				},
			},
		});
	}

	/**
	 * Delete old failed/orphaned jobs
	 */
	async cleanupOldJobs(olderThanDays = 30) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		const result = await prisma.clipJob.deleteMany({
			where: {
				status: ClipJobStatus.FAILED,
				createdAt: { lt: cutoffDate },
			},
		});

		console.log(`[ClipJob] Cleaned up ${result.count} old failed jobs`);
		return result.count;
	}

	/**
	 * Get all clip jobs with pagination
	 * Used for the clips management view in the media library
	 */
	async getAllClips(
		options: {
			page?: number;
			limit?: number;
			status?: ClipJobStatus;
			search?: string;
		} = {},
	) {
		const { page = 1, limit = 20, status, search } = options;
		const skip = (page - 1) * limit;

		const where: any = {};

		if (status) {
			where.status = status;
		}

		if (search) {
			where.sourceMedia = {
				OR: [{ originalName: { contains: search } }, { filename: { contains: search } }],
			};
		}

		const [clips, total] = await Promise.all([
			prisma.clipJob.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: "desc" },
				include: {
					sourceMedia: {
						select: {
							id: true,
							uuid: true,
							filename: true,
							originalName: true,
							mimeType: true,
							metadata: true,
						},
					},
					work: {
						select: {
							id: true,
							title: true,
							slug: true,
						},
					},
				},
			}),
			prisma.clipJob.count({ where }),
		]);

		return {
			clips,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get the default clip for a media file
	 */
	async getDefaultClip(sourceMediaId: number) {
		return prisma.clipJob.findFirst({
			where: {
				sourceMediaId,
				isDefault: true,
			},
			orderBy: { createdAt: "desc" },
			include: {
				sourceMedia: {
					select: {
						id: true,
						uuid: true,
						optimizedUrls: true,
						metadata: true,
					},
				},
			},
		});
	}

	/**
	 * Unset all existing default clips for a media file
	 * Used before setting a new default clip
	 */
	async unsetDefaultClips(sourceMediaId: number) {
		return prisma.clipJob.updateMany({
			where: {
				sourceMediaId,
				isDefault: true,
			},
			data: {
				isDefault: false,
			},
		});
	}

	/**
	 * Set a clip as default
	 */
	async setDefault(clipJobId: string) {
		return prisma.clipJob.update({
			where: { id: clipJobId },
			data: { isDefault: true },
		});
	}

	/**
	 * Get clip usage — where is this clip referenced?
	 */
	async getClipUsage(clipJobId: string) {
		const [homepageDirectors, directorsPageSelections] = await Promise.all([
			prisma.homepageDirector.findMany({
				where: { clipJobId },
				select: {
					id: true,
					work: { select: { id: true, title: true } },
					director: { select: { id: true, title: true } },
				},
			}),
			prisma.directorsPageSelection.findMany({
				where: { clipJobId },
				select: {
					id: true,
					work: { select: { id: true, title: true } },
					director: { select: { id: true, title: true } },
				},
			}),
		]);

		// Check block content JSON for clipJobId references
		const blocks = await prisma.block.findMany({
			where: {
				content: { path: "$.items", string_contains: clipJobId },
			},
			select: {
				id: true,
				modelName: true,
				modelId: true,
			},
		});

		// Enrich blocks with model titles
		const enrichedBlocks = await Promise.all(
			blocks.map(async (block) => {
				let modelTitle: string | null = null;
				if (block.modelId) {
					if (block.modelName === "work") {
						const work = await prisma.work.findUnique({ where: { id: block.modelId }, select: { title: true } });
						modelTitle = work?.title || null;
					} else if (block.modelName === "director") {
						const director = await prisma.director.findUnique({
							where: { id: block.modelId },
							select: { title: true },
						});
						modelTitle = director?.title || null;
					} else if (block.modelName === "block_page") {
						const page = await prisma.blockPage.findUnique({ where: { id: block.modelId }, select: { title: true } });
						modelTitle = page?.title || null;
					}
				}
				return { ...block, modelTitle };
			}),
		);

		return { homepageDirectors, directorsPageSelections, blocks: enrichedBlocks };
	}

	/**
	 * Delete a clip job (only if not in use)
	 */
	async deleteClip(clipJobId: string) {
		const usage = await this.getClipUsage(clipJobId);
		const isInUse =
			usage.homepageDirectors.length > 0 || usage.directorsPageSelections.length > 0 || usage.blocks.length > 0;

		if (isInUse) {
			throw new Error("Cannot delete clip: it is currently in use");
		}

		return prisma.clipJob.delete({ where: { id: clipJobId } });
	}

	/**
	 * Retry a failed clip job by resetting its status to PENDING
	 */
	async retryClip(clipJobId: string) {
		const clip = await prisma.clipJob.findUnique({ where: { id: clipJobId } });
		if (!clip) throw new Error("Clip job not found");
		if (clip.status !== ClipJobStatus.FAILED) throw new Error("Can only retry failed clips");

		return prisma.clipJob.update({
			where: { id: clipJobId },
			data: {
				status: ClipJobStatus.PENDING,
				progress: 0,
				errorMessage: null,
				outputPath: null,
				thumbnailPath: null,
				outputMetadata: Prisma.JsonNull,
			},
		});
	}
}

// Export singleton instance
export const clipJobService = new ClipJobService();
