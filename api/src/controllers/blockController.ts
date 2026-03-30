import { Request, Response, NextFunction } from "express";
import { blockService, blockPageService, BlockContent } from "../services/blockService";
import { BlockType, BlockPageType, Status } from "@prisma/client";
import { clipProcessingService, ClipProcessingStatus } from "../services/clipProcessingService";
import { clipJobService } from "../services/clipJobService";
import { prisma } from "../config/database";
import { isOriginAllowed } from "../utils/cors";

// ============================================
// BLOCK CONTROLLER
// ============================================

/**
 * Get blocks for a model
 * GET /api/blocks?modelName=block_page&modelId=1
 */
export async function getBlocks(req: Request, res: Response, next: NextFunction) {
	try {
		const { modelName, modelId, sessionId, status, includeChildren } = req.query;

		if (!modelName) {
			return res.status(400).json({ error: "modelName is required" });
		}

		const blocks = await blockService.getBlocks({
			modelName: modelName as string,
			modelId: modelId ? parseInt(modelId as string) : undefined,
			sessionId: sessionId as string,
			status: status as Status,
			includeChildren: includeChildren !== "false",
		});

		// Enrich blocks with work details (title, slug, media URLs)
		const enrichedBlocks = await blockPageService.enrichBlocksWithWorkDetails(blocks, { minimal: false });

		res.json({ data: enrichedBlocks });
	} catch (error) {
		next(error);
	}
}

/**
 * Get a single block by ID
 * GET /api/blocks/:id
 */
export async function getBlockById(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const block = await blockService.getBlockById(parseInt(id as string));

		if (!block) {
			return res.status(404).json({ error: "Block not found" });
		}

		res.json({ data: block });
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new block
 * POST /api/blocks
 */
export async function createBlock(req: Request, res: Response, next: NextFunction) {
	try {
		const { modelName, modelId, parentId, type, content, position, status } = req.body;

		if (!modelName || !type) {
			return res.status(400).json({ error: "modelName and type are required" });
		}

		// Validate block type
		if (!Object.values(BlockType).includes(type)) {
			return res.status(400).json({ error: "Invalid block type" });
		}

		const block = await blockService.createBlock({
			modelName,
			modelId: modelId || null,
			parentId: parentId || null,
			type,
			content: content as BlockContent,
			position,
			status: status || Status.DRAFT,
		});

		res.status(201).json({ data: block });
	} catch (error) {
		next(error);
	}
}

/**
 * Update a block
 * PUT /api/blocks/:id
 */
export async function updateBlock(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { type, content, position, status, parentId } = req.body;

		// Validate block type if provided
		if (type && !Object.values(BlockType).includes(type)) {
			return res.status(400).json({ error: "Invalid block type" });
		}

		const block = await blockService.updateBlock(parseInt(id as string), {
			type,
			content: content as BlockContent,
			position,
			status,
			parentId,
		});

		res.json({ data: block });
	} catch (error) {
		next(error);
	}
}

/**
 * Delete a block
 * DELETE /api/blocks/:id
 */
export async function deleteBlock(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await blockService.deleteBlock(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Process video for a block slot (crop/trim via MediaConvert)
 * POST /api/blocks/:id/process-video
 */
export async function processVideo(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { slotIndex, workId, cropSettings, trimSettings, mode } = req.body;

		// Validate required fields
		if (slotIndex === undefined || slotIndex === null) {
			return res.status(400).json({ error: "slotIndex is required" });
		}

		// In thumbnail mode, only cropSettings is required (trimSettings is built from frameTime)
		if (mode !== "thumbnail" && !cropSettings && !trimSettings) {
			return res.status(400).json({ error: "At least one of cropSettings or trimSettings is required" });
		}

		if (mode === "thumbnail" && !cropSettings && !trimSettings) {
			return res.status(400).json({ error: "cropSettings or trimSettings is required for thumbnail generation" });
		}

		// Check if clip processing is available
		if (!clipProcessingService.isAvailable()) {
			return res.status(503).json({ error: "Video processing is not configured" });
		}

		// Get the block
		const block = await blockService.getBlockById(parseInt(id as string));
		if (!block) {
			return res.status(404).json({ error: "Block not found" });
		}

		// Get the content item at the slot index
		const content = block.content as BlockContent;
		let items = content?.items || [];

		// If slot doesn't exist but workId is provided, create the slot
		let item = items[slotIndex];
		if (!item && workId) {
			// Extend items array to include this slot
			while (items.length <= slotIndex) {
				items.push({});
			}
			items[slotIndex] = { workId };
			item = items[slotIndex];

			// Save the updated block content
			await blockService.updateBlock(block.id, {
				content: { ...content, items },
			});
		}

		if (!item) {
			return res.status(400).json({ error: `Slot ${slotIndex} not found in block` });
		}

		// Use workId from request if provided, otherwise from existing item
		const targetWorkId = workId || item.workId;

		// Must have a workId with video
		if (!targetWorkId) {
			return res.status(400).json({ error: "Block slot does not have an associated work" });
		}

		// Get the work to find the video file
		let entityVideoFileId: number | null = null;
		let entityVideoFile: any = null;
		let entityId: number | null = null;

		const work = await blockPageService.getWorkWithVideo(targetWorkId);
		if (!work) {
			return res.status(404).json({ error: "Work not found" });
		}
		entityVideoFileId = work.videoFileId;
		entityVideoFile = work.videoFile;
		entityId = work.id;

		if (!entityVideoFileId || !entityVideoFile) {
			return res.status(400).json({ error: "Entity does not have a video file" });
		}

		// Check video processing status
		const videoFile = entityVideoFile;
		const videoMetadata = videoFile.metadata as { width?: number; height?: number } | null;
		const optimizedUrls = videoFile.optimizedUrls as Record<string, string> | null;
		const hasOptimizedVideos = optimizedUrls && (optimizedUrls["1080p"] || optimizedUrls["720p"]);

		// Normalize processing status to uppercase for comparison (DB may have lowercase values)
		const processingStatus = (videoFile.processingStatus || "").toUpperCase();

		// Allow processing if we have metadata OR if the video is completed with optimized URLs
		// (older videos may not have metadata but still have optimized URLs we can use)
		if (!videoMetadata?.width || !videoMetadata?.height) {
			if (processingStatus === "COMPLETED" && hasOptimizedVideos) {
				// Proceed - clipProcessingService will use default 1920x1080
				console.log(
					`[ProcessVideo] Video ${videoFile.id} has no metadata but has optimized URLs, proceeding with defaults`,
				);
			} else if (processingStatus === "PENDING" || processingStatus === "PROCESSING") {
				return res.status(400).json({
					error: "Video is still processing",
					message: "Please wait for the original video to finish processing before applying crop/trim settings.",
					processingStatus: videoFile.processingStatus,
				});
			} else if (processingStatus === "FAILED") {
				return res.status(400).json({
					error: "Video processing failed",
					message: "The video failed to process. Please re-upload the video or contact support.",
				});
			} else {
				return res.status(400).json({
					error: "Video metadata not available",
					message: "The video hasn't been processed yet. Please wait or contact support.",
				});
			}
		}

		// Create clip processing job (using new ClipJob table)
		const jobResult = await clipProcessingService.createClipJob({
			contextType: "block",
			contextId: block.id,
			slotIndex,
			blockType: block.type,
			mediaFileId: entityVideoFileId,
			workId: targetWorkId || undefined, // For verification during webhook updates
			cropSettings,
			trimSettings,
			mode: mode === "thumbnail" ? "thumbnail" : "clip",
		});

		if (!jobResult) {
			return res.status(500).json({ error: "Failed to create processing job" });
		}

		// Update block content with pending status
		const newContent = { ...content };
		newContent.items = [...items];

		if (mode === "thumbnail") {
			// Thumbnail mode: store in generatedThumbnail field
			newContent.items[slotIndex] = {
				...item,
				cropSettings,
				generatedThumbnail: {
					status: ClipProcessingStatus.PENDING,
					settingsHash: jobResult.settingsHash,
					clipJobId: jobResult.clipJobId,
					cropSettings,
					frameTime: trimSettings?.startTime || 0,
				},
			};
		} else {
			// Clip mode: store in processedVideo field (existing behavior)
			newContent.items[slotIndex] = {
				...item,
				cropSettings,
				trimSettings,
				processedVideo: {
					status: ClipProcessingStatus.PENDING,
					settingsHash: jobResult.settingsHash,
					outputPath: jobResult.outputPath,
					jobId: jobResult.jobId,
					clipJobId: jobResult.clipJobId,
				},
			};
		}

		// Save updated block
		await blockService.updateBlock(block.id, { content: newContent });

		res.json({
			success: true,
			data: {
				jobId: jobResult.jobId,
				settingsHash: jobResult.settingsHash,
				status: ClipProcessingStatus.PENDING,
			},
		});
	} catch (error) {
		next(error);
	}
}

/**
 * Reorder blocks
 * PUT /api/blocks/reorder
 */
export async function reorderBlocks(req: Request, res: Response, next: NextFunction) {
	try {
		const { blocks } = req.body;

		if (!blocks || !Array.isArray(blocks)) {
			return res.status(400).json({ error: "blocks array is required" });
		}

		await blockService.reorderBlocks({ blocks });
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Assign temporary blocks to an entity
 * PUT /api/blocks/assign
 */
export async function assignBlocks(req: Request, res: Response, next: NextFunction) {
	try {
		const { modelName, sessionId, modelId } = req.body;

		if (!modelName || !sessionId || !modelId) {
			return res.status(400).json({ error: "modelName, sessionId, and modelId are required" });
		}

		await blockService.assignBlocksToEntity(modelName, sessionId, modelId);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Publish blocks for an entity
 * PUT /api/blocks/publish
 */
export async function publishBlocks(req: Request, res: Response, next: NextFunction) {
	try {
		const { modelName, modelId } = req.body;

		if (!modelName || !modelId) {
			return res.status(400).json({ error: "modelName and modelId are required" });
		}

		await blockService.publishBlocks(modelName, modelId);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

// ============================================
// BLOCK PAGE CONTROLLER
// ============================================

/**
 * Get all block pages
 * GET /api/block-pages
 */
export async function getBlockPages(req: Request, res: Response, next: NextFunction) {
	try {
		const pages = await blockPageService.getBlockPages();
		res.json({ data: pages });
	} catch (error) {
		next(error);
	}
}

/**
 * Get a block page by type
 * GET /api/block-pages/:type
 */
export async function getBlockPageByType(req: Request, res: Response, next: NextFunction) {
	try {
		const { type } = req.params;

		// Validate page type
		if (!Object.values(BlockPageType).includes(type as BlockPageType)) {
			return res.status(400).json({ error: "Invalid page type" });
		}

		const page = await blockPageService.getBlockPageByType(type as BlockPageType);

		if (!page) {
			return res.status(404).json({ error: "Block page not found" });
		}

		res.json({ data: page });
	} catch (error) {
		next(error);
	}
}

/**
 * Update a block page
 * PUT /api/block-pages/:id
 */
export async function updateBlockPage(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { title, status } = req.body;

		const page = await blockPageService.updateBlockPage(parseInt(id as string), {
			title,
			status,
		});

		res.json({ data: page });
	} catch (error) {
		next(error);
	}
}

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * Get published blocks for a page type (public)
 * GET /api/public/pages/:type/blocks
 */
export async function getPublicPageBlocks(req: Request, res: Response, next: NextFunction) {
	try {
		const { type } = req.params;
		const page = Math.max(1, Number(req.query.page ?? 1));
		const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 5)));

		// Validate page type
		if (!Object.values(BlockPageType).includes(type as BlockPageType)) {
			return res.status(400).json({ error: "Invalid page type" });
		}

		const blockPage = await blockPageService.getBlockPageByType(type as BlockPageType, {
			page,
			limit,
		});

		if (!blockPage || blockPage.status !== Status.PUBLISHED) {
			return res.status(404).json({ error: "Page not found" });
		}

		// Sort by position
		const sortedBlocks = blockPage.blocks.sort((a, b) => a.position - b.position);

		// Enrich blocks with work details (title, slug, media URLs)
		const enrichedBlocks = await blockPageService.enrichBlocksWithWorkDetails(sortedBlocks);

		// Get total count for pagination meta
		const total = await blockPageService.countBlocksForPageType(type as BlockPageType);

		// Cache headers - vary by page number
		res.set("Cache-Control", "public, max-age=60, s-maxage=300");

		res.json({
			data: enrichedBlocks,
			meta: {
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	} catch (error) {
		next(error);
	}
}

// ============================================
// SSE ENDPOINT
// ============================================

// Store active SSE connections per block
const blockSSEConnections = new Map<number, Set<Response>>();

/**
 * SSE endpoint for real-time clip processing updates
 * GET /api/blocks/:id/events
 */
export async function getBlockEventsSSE(req: Request, res: Response, next: NextFunction) {
	try {
		const idParam = req.params.id;
		const blockId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);

		if (isNaN(blockId)) {
			return res.status(400).json({ error: "Invalid block ID" });
		}

		// Verify block exists
		const block = await prisma.block.findUnique({
			where: { id: blockId },
		});

		if (!block) {
			return res.status(404).json({ error: "Block not found" });
		}

		// Set CORS headers explicitly for SSE (credentials require specific origin, not *)
		const origin = req.headers.origin;
		if (origin && isOriginAllowed(origin)) {
			res.setHeader("Access-Control-Allow-Origin", origin);
			res.setHeader("Access-Control-Allow-Credentials", "true");
		}

		// Set SSE headers
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
		res.flushHeaders();

		// Register this connection
		if (!blockSSEConnections.has(blockId)) {
			blockSSEConnections.set(blockId, new Set());
		}
		blockSSEConnections.get(blockId)!.add(res);

		console.log(
			`[SSE] Client connected to block ${blockId} events. Active connections: ${blockSSEConnections.get(blockId)!.size}`,
		);

		// Send initial state with current clip jobs
		const clipJobs = await clipJobService.getJobsForContext("block", blockId);
		const initialData = {
			type: "initial",
			blockId,
			clipJobs: clipJobs.map((job) => ({
				id: job.id,
				slotIndex: job.slotIndex,
				status: job.status,
				progress: job.progress,
				outputPath: job.outputPath,
				thumbnailPath: job.thumbnailPath,
				settingsHash: job.settingsHash,
			})),
		};

		res.write(`data: ${JSON.stringify(initialData)}\n\n`);

		// Keep-alive ping every 30 seconds
		const keepAlive = setInterval(() => {
			res.write(`:ping\n\n`);
		}, 30000);

		// Handle client disconnect
		req.on("close", () => {
			clearInterval(keepAlive);
			const connections = blockSSEConnections.get(blockId);
			if (connections) {
				connections.delete(res);
				if (connections.size === 0) {
					blockSSEConnections.delete(blockId);
				}
			}
			console.log(`[SSE] Client disconnected from block ${blockId} events. Remaining: ${connections?.size || 0}`);
		});
	} catch (error) {
		next(error);
	}
}

/**
 * Broadcast clip update to all connected SSE clients for a block
 */
export function broadcastClipUpdate(
	blockId: number,
	data: {
		type: "clip_update" | "clip_complete" | "clip_failed" | "thumbnail_complete" | "thumbnail_failed";
		slotIndex: number;
		clipJobId: string;
		status: string;
		progress?: number;
		outputPath?: string;
		thumbnailPath?: string;
		outputUrl?: string;
		thumbnailUrl?: string;
		error?: string;
	},
) {
	const connections = blockSSEConnections.get(blockId);
	if (!connections || connections.size === 0) {
		return;
	}

	const message = JSON.stringify({ blockId, ...data });
	connections.forEach((res) => {
		res.write(`data: ${message}\n\n`);
	});

	console.log(`[SSE] Broadcasted ${data.type} to ${connections.size} clients for block ${blockId}`);
}
