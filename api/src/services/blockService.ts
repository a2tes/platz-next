import { prisma } from "../config/database";
import { Status, BlockType, BlockPageType, Prisma, ClipJobStatus } from "@prisma/client";
import { serializeMediaFile } from "../utils/serialization";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";

// ============================================
// TYPES
// ============================================

export interface ProcessedVideoData {
	url?: string;
	thumbnailUrl?: string;
	status: "pending" | "processing" | "completed" | "failed";
	jobId?: string;
	settingsHash?: string;
	outputPath?: string;
	resolution?: string;
	error?: string;
	createdAt?: string;
	completedAt?: string;
	clipJobId?: string; // Database ClipJob ID
}

export interface CropSettings {
	x: number;
	y: number;
	width: number;
	height: number;
	aspect: number;
}

export interface TrimSettings {
	startTime: number;
	endTime: number;
}

export interface BlockContentItem {
	workId?: number;
	cropX?: number;
	cropY?: number;
	cropW?: number;
	cropH?: number;
	trimStart?: number;
	trimEnd?: number;
	cropSettings?: CropSettings;
	trimSettings?: TrimSettings;
	processedVideo?: ProcessedVideoData;
	generatedThumbnail?: { url?: string; [key: string]: unknown };
	displayMode?: string;
	[key: string]: unknown;
}

export interface BlockContent {
	items?: BlockContentItem[];
	text?: string;
	mediaId?: number;
	[key: string]: unknown;
}

export interface CreateBlockData {
	modelName: string;
	modelId?: number | null;
	parentId?: number | null;
	type: BlockType;
	content?: BlockContent;
	position?: number;
	status?: Status;
}

export interface UpdateBlockData {
	type?: BlockType;
	content?: BlockContent;
	position?: number;
	status?: Status;
	parentId?: number | null;
}

export interface ReorderBlocksData {
	blocks: { id: number; position: number }[];
}

export interface GetBlocksQuery {
	modelName: string;
	modelId?: number | null;
	sessionId?: string;
	status?: Status;
	includeChildren?: boolean;
}

// ============================================
// BLOCK SERVICE
// ============================================

export class BlockService {
	/**
	 * Get blocks for a specific model (page, work, etc.)
	 */
	async getBlocks(query: GetBlocksQuery) {
		const { modelName, modelId, sessionId, status, includeChildren = true } = query;

		const where: any = {
			modelName,
			parentId: null, // Only get top-level blocks
		};

		if (modelId !== undefined) {
			where.modelId = modelId;
		}

		if (sessionId) {
			// For new entities, filter by UUID pattern containing sessionId
			where.uuid = { contains: sessionId };
		}

		if (status) {
			where.status = status;
		}

		const blocks = await prisma.block.findMany({
			where,
			orderBy: { position: "asc" },
			include: includeChildren
				? {
						children: {
							orderBy: { position: "asc" },
						},
					}
				: undefined,
		});

		return blocks;
	}

	/**
	 * Get a single block by ID
	 */
	async getBlockById(id: number) {
		return prisma.block.findUnique({
			where: { id },
			include: {
				children: {
					orderBy: { position: "asc" },
				},
			},
		});
	}

	/**
	 * Get a single block by UUID
	 */
	async getBlockByUuid(uuid: string) {
		return prisma.block.findUnique({
			where: { uuid },
			include: {
				children: {
					orderBy: { position: "asc" },
				},
			},
		});
	}

	/**
	 * Create a new block
	 */
	async createBlock(data: CreateBlockData) {
		const { content, ...blockData } = data;

		// Get next position if not provided
		let position = data.position;
		if (position === undefined) {
			const lastBlock = await prisma.block.findFirst({
				where: {
					modelName: data.modelName,
					modelId: data.modelId,
					parentId: data.parentId || null,
				},
				orderBy: { position: "desc" },
			});
			position = (lastBlock?.position || 0) + 1;
		}

		const block = await prisma.block.create({
			data: {
				...blockData,
				content: (content || {}) as Prisma.JsonObject,
				position,
				status: data.status || Status.DRAFT,
			},
			include: {
				children: true,
			},
		});

		return block;
	}

	/**
	 * Update an existing block
	 */
	async updateBlock(id: number, data: UpdateBlockData) {
		const { content, parentId, ...updateData } = data;

		const block = await prisma.block.update({
			where: { id },
			data: {
				...updateData,
				...(content !== undefined && { content: content as Prisma.JsonObject }),
				...(parentId !== undefined && { parentId }),
			},
			include: {
				children: {
					orderBy: { position: "asc" },
				},
			},
		});

		return block;
	}

	/**
	 * Delete a block and its children
	 */
	async deleteBlock(id: number) {
		// Prisma will cascade delete children due to onDelete: Cascade
		await prisma.block.delete({
			where: { id },
		});

		return { success: true };
	}

	/**
	 * Reorder blocks
	 */
	async reorderBlocks(data: ReorderBlocksData) {
		const updates = data.blocks.map((block) =>
			prisma.block.update({
				where: { id: block.id },
				data: { position: block.position },
			}),
		);

		await prisma.$transaction(updates);

		return { success: true };
	}

	/**
	 * Assign temporary blocks to an entity
	 * Used when saving a new entity that has blocks created before the entity was saved
	 */
	async assignBlocksToEntity(modelName: string, sessionId: string, modelId: number) {
		await prisma.block.updateMany({
			where: {
				modelName,
				modelId: null,
				uuid: { contains: sessionId },
			},
			data: {
				modelId,
			},
		});

		return { success: true };
	}

	/**
	 * Duplicate blocks from one entity to another
	 */
	async duplicateBlocks(
		sourceModelName: string,
		sourceModelId: number,
		targetModelName: string,
		targetModelId: number,
	) {
		const sourceBlocks = await this.getBlocks({
			modelName: sourceModelName,
			modelId: sourceModelId,
		});

		for (const block of sourceBlocks) {
			const { id, uuid, createdAt, updatedAt, children, ...blockData } = block as any;

			const newBlock = await this.createBlock({
				...blockData,
				modelName: targetModelName,
				modelId: targetModelId,
			});

			// Duplicate children if any
			if (children && children.length > 0) {
				for (const child of children) {
					const {
						id: childId,
						uuid: childUuid,
						createdAt: childCreated,
						updatedAt: childUpdated,
						...childData
					} = child;
					await this.createBlock({
						...childData,
						modelName: targetModelName,
						modelId: targetModelId,
						parentId: newBlock.id,
					});
				}
			}
		}

		return { success: true };
	}

	/**
	 * Publish all draft blocks for an entity
	 */
	async publishBlocks(modelName: string, modelId: number) {
		await prisma.block.updateMany({
			where: {
				modelName,
				modelId,
				status: Status.DRAFT,
			},
			data: {
				status: Status.PUBLISHED,
			},
		});

		return { success: true };
	}

	/**
	 * Get published blocks for public API
	 */
	async getPublishedBlocks(modelName: string, modelId: number) {
		return this.getBlocks({
			modelName,
			modelId,
			status: Status.PUBLISHED,
		});
	}
}

// ============================================
// BLOCK PAGE SERVICE
// ============================================

export class BlockPageService {
	/**
	 * Get all block pages
	 */
	async getBlockPages() {
		return prisma.blockPage.findMany({
			orderBy: { type: "asc" },
		});
	}

	/**
	 * Get a block page by type with optional pagination
	 */
	async getBlockPageByType(
		type: BlockPageType,
		options?: {
			page?: number;
			limit?: number;
		},
	) {
		const page = options?.page || 1;
		const limit = options?.limit;
		const skip = limit ? (page - 1) * limit : undefined;

		const blockPage = await prisma.blockPage.findUnique({
			where: { type },
		});
		if (!blockPage) return null;

		const blocks = await prisma.block.findMany({
			where: {
				modelName: "BlockPage",
				modelId: blockPage.id,
				parentId: null,
			},
			orderBy: { position: "asc" },
			...(skip !== undefined && { skip }),
			...(limit !== undefined && { take: limit }),
			include: {
				children: {
					orderBy: { position: "asc" },
				},
			},
		});

		return { ...blockPage, blocks };
	}

	/**
	 * Count total blocks for a page type (for pagination)
	 */
	async countBlocksForPageType(type: BlockPageType): Promise<number> {
		const blockPage = await prisma.blockPage.findUnique({
			where: { type },
			select: { id: true },
		});

		if (!blockPage) return 0;

		return prisma.block.count({
			where: {
				modelId: blockPage.id,
				parentId: null,
			},
		});
	}

	/**
	 * Get a block page by ID
	 */
	async getBlockPageById(id: number) {
		const blockPage = await prisma.blockPage.findUnique({
			where: { id },
		});
		if (!blockPage) return null;

		const blocks = await prisma.block.findMany({
			where: {
				modelName: "BlockPage",
				modelId: blockPage.id,
				parentId: null,
			},
			orderBy: { position: "asc" },
			include: {
				children: {
					orderBy: { position: "asc" },
				},
			},
		});

		return { ...blockPage, blocks };
	}

	/**
	 * Update block page status
	 */
	async updateBlockPage(id: number, data: { title?: string; status?: Status }) {
		return prisma.blockPage.update({
			where: { id },
			data,
		});
	}

	/**
	 * Get work with video file for clip processing
	 */
	async getWorkWithVideo(workId: number) {
		return prisma.work.findUnique({
			where: { id: workId },
			select: {
				id: true,
				slug: true,
				videoFileId: true,
				videoFile: {
					select: {
						id: true,
						processingStatus: true,
						metadata: true,
						optimizedUrls: true,
					},
				},
			},
		});
	}

	/**
	 * Compute aspect ratio from MediaFile metadata
	 */
	private computeVideoAspectRatio(videoFile: any): number {
		const metadata = videoFile?.metadata as { width?: number; height?: number } | null;
		if (metadata?.width && metadata?.height) {
			return Math.round((metadata.width / metadata.height) * 1000) / 1000;
		}
		return 16 / 9; // fallback
	}

	/**
	 * Enrich blocks with work details
	 * Fetches work information for block items that only have workId
	 * Admin mode returns structured { workId, displayMode, work, clip? } format
	 * Public mode returns minimal data for rendering
	 */
	async enrichBlocksWithWorkDetails(blocks: any[], { minimal = true }: { minimal?: boolean } = {}) {
		// Collect all unique workIds from all blocks
		const workIds = new Set<number>();
		for (const block of blocks) {
			const items = (block.content as BlockContent)?.items || [];
			for (const item of items) {
				if (item.workId) {
					workIds.add(item.workId);
				}
			}
		}

		if (workIds.size === 0) {
			return blocks;
		}

		// Fetch works
		const works =
			workIds.size > 0
				? await prisma.work.findMany({
						where: { id: { in: Array.from(workIds) }, status: "PUBLISHED", deletedAt: null },
						include: {
							videoFile: true,
							previewImage: true,
						},
					})
				: [];

		// Create a lookup map with work data including aspect ratios
		const workMap = new Map(
			works.map((w) => {
				const serializedVideoFile = serializeMediaFile(w.videoFile);
				const serializedPreviewImage = w.previewImage ? serializeMediaFile(w.previewImage) : null;

				// Get thumbnail from previewImage or video file (use medium size for works page)
				const thumbnailUrl =
					serializedPreviewImage?.images?.medium ||
					serializedPreviewImage?.images?.thumbnail ||
					serializedVideoFile?.images?.medium ||
					serializedVideoFile?.images?.thumbnail ||
					serializedVideoFile?.thumbnailPath ||
					null;

				const videoAspectRatio = this.computeVideoAspectRatio(w.videoFile);

				return [
					w.id,
					{
						title: w.title,
						slug: w.slug,
						client: w.client || "",

						shortDescription: w.shortDescription || "",
						videoUrl:
							serializedVideoFile?.video?.mp4_720p ||
							serializedVideoFile?.video?.mp4 ||
							serializedVideoFile?.video?.default ||
							null,
						videoAspectRatio,
						thumbnailUrl,
						thumbnailAspectRatio: videoAspectRatio, // base; overridden per-item if crop applied
					},
				];
			}),
		);

		// Fetch ClipJobs to use as source of truth for clip status/thumbnails
		// (block content processedVideo can become stale if save mutation overwrites webhook data)
		const clipJobsByBlockSlot = new Map<string, any>();
		const blockIds = blocks.map((b) => b.id).filter(Boolean);
		if (blockIds.length > 0) {
			const clipJobs = await prisma.clipJob.findMany({
				where: {
					contextType: "block",
					contextId: { in: blockIds },
				},
				orderBy: { createdAt: "desc" },
			});
			// Build lookup by blockId:slotIndex, keeping only the latest per slot
			for (const job of clipJobs) {
				const key = `${job.contextId}:${job.slotIndex ?? 0}`;
				if (!clipJobsByBlockSlot.has(key)) {
					clipJobsByBlockSlot.set(key, job);
				}
			}
		}

		return blocks.map((block) => {
			const items = (block.content as BlockContent)?.items || [];
			const enrichedItems = items.map((item: BlockContentItem, itemIndex: number) => {
				const entityId = item.workId;
				if (!entityId) return item;

				const entity = workMap.get(entityId);
				if (!entity) return item;

				const displayMode = item.displayMode || "video";

				// Per-item thumbnail: block-specific generated thumbnail takes priority
				const itemThumbnailUrl = item.generatedThumbnail?.url || entity.thumbnailUrl;
				// Per-item thumbnail aspect ratio: from crop settings if applied, else from video
				const itemThumbnailAspectRatio =
					(item.generatedThumbnail?.cropSettings as CropSettings | undefined)?.aspect ||
					item.cropSettings?.aspect ||
					entity.videoAspectRatio;

				if (!minimal) {
					// Admin mode: structured response with work + clip separation
					const enrichedWork = {
						title: entity.title,
						slug: entity.slug,
						videoUrl: entity.videoUrl,
						videoAspectRatio: entity.videoAspectRatio,
						thumbnailUrl: itemThumbnailUrl,
						thumbnailAspectRatio: itemThumbnailAspectRatio,
					};

					const result: any = {
						...(item.workId && { workId: item.workId }),
						displayMode,
						work: enrichedWork,
					};

					// Only include clip object when displayMode is "video"
					if (displayMode === "video") {
						// Use ClipJob as source of truth when available (block content processedVideo can be stale)
						const clipJob = clipJobsByBlockSlot.get(`${block.id}:${itemIndex}`);
						const cfDomain = VIDEO_PROCESSING_CONFIG.cloudfront?.domain;

						if (clipJob) {
							const clipVideoUrl = clipJob.outputPath
								? `https://${cfDomain}/${clipJob.outputPath}`
								: clipJob.outputUrl || null;
							const clipThumbnailUrl = clipJob.thumbnailPath ? `https://${cfDomain}/${clipJob.thumbnailPath}` : null;
							const clipStatus =
								clipJob.status === ClipJobStatus.COMPLETED
									? "completed"
									: clipJob.status === ClipJobStatus.FAILED
										? "failed"
										: clipJob.status === ClipJobStatus.PROCESSING
											? "processing"
											: "pending";

							result.clip = {
								videoUrl: clipVideoUrl,
								thumbnailUrl: clipThumbnailUrl,
								status: clipStatus,
								error: clipJob.errorMessage || null,
								cropSettings: item.cropSettings || null,
								trimSettings: item.trimSettings || null,
							};
						} else {
							result.clip = {
								videoUrl: item.processedVideo?.url || null,
								thumbnailUrl: item.processedVideo?.thumbnailUrl || null,
								status: item.processedVideo?.status || null,
								error: item.processedVideo?.error || null,
								cropSettings: item.cropSettings || null,
								trimSettings: item.trimSettings || null,
							};
						}
					}

					return result;
				}

				// Public mode: minimal response for rendering
				// Use ClipJob as source of truth for clip URL and thumbnail
				const clipJob = clipJobsByBlockSlot.get(`${block.id}:${itemIndex}`);
				const cfDomain = VIDEO_PROCESSING_CONFIG.cloudfront?.domain;

				let clipUrl: string | undefined;
				let clipThumbnailUrl: string | null = null;

				if (clipJob && clipJob.status === ClipJobStatus.COMPLETED) {
					clipUrl = clipJob.outputPath ? `https://${cfDomain}/${clipJob.outputPath}` : clipJob.outputUrl || undefined;
					clipThumbnailUrl = clipJob.thumbnailPath ? `https://${cfDomain}/${clipJob.thumbnailPath}` : null;
				} else if (item.processedVideo?.url) {
					clipUrl = item.processedVideo.url;
					clipThumbnailUrl = item.processedVideo.thumbnailUrl || null;
				}

				// When clip has its own thumbnail, use it instead of the entity's (it's crop-specific)
				const publicThumbnailUrl = clipThumbnailUrl || itemThumbnailUrl;

				return {
					display: displayMode,
					...(clipUrl && { clip: { url: clipUrl } }),
					work: {
						...entity,
						thumbnailUrl: publicThumbnailUrl,
						thumbnailAspectRatio: itemThumbnailAspectRatio,
					},
				};
			});

			return {
				id: block.id,
				type: block.type,
				content: { items: enrichedItems },
				position: block.position,
			};
		});
	}
}

// Export singleton instances
export const blockService = new BlockService();
export const blockPageService = new BlockPageService();
