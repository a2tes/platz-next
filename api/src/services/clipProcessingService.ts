import { MediaConvertClient, CreateJobCommand, CreateJobCommandInput } from "@aws-sdk/client-mediaconvert";
import { createHash } from "crypto";
import { prisma } from "../config/database";
import { BlockType, ClipJobStatus } from "@prisma/client";
import { VIDEO_PROCESSING_CONFIG, isVideoProcessingConfigured } from "../config/videoProcessing";
import { clipJobService } from "./clipJobService";

// Forward declaration to avoid circular dependency
let broadcastClipUpdate: typeof import("../controllers/blockController").broadcastClipUpdate | null = null;

// Lazy load the broadcast function
function getBroadcastFunction() {
	if (!broadcastClipUpdate) {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		broadcastClipUpdate = require("../controllers/blockController").broadcastClipUpdate;
	}
	return broadcastClipUpdate;
}

/**
 * Clip processing status
 */
export enum ClipProcessingStatus {
	PENDING = "pending",
	PROCESSING = "processing",
	COMPLETED = "completed",
	FAILED = "failed",
}

/**
 * Crop settings interface (stored as percentages)
 */
interface CropSettings {
	x: number; // % (0-100)
	y: number; // % (0-100)
	width: number; // % (0-100)
	height: number; // % (0-100)
	aspect: number;
	aspectLabel?: string;
}

/**
 * Trim settings interface
 */
interface TrimSettings {
	startTime: number; // seconds
	endTime: number; // seconds
}

/**
 * Video metadata from MediaFile
 */
interface VideoMetadata {
	width: number;
	height: number;
	duration?: number;
}

/**
 * MediaConvert crop settings (in pixels)
 */
interface MediaConvertCrop {
	X: number;
	Y: number;
	Width: number;
	Height: number;
}

/**
 * Resolution configuration
 */
interface ResolutionConfig {
	maxDimension: number;
	bitrate: number;
	name: "1080p" | "720p" | "480p";
}

/**
 * Clip job result
 */
interface ClipJobResult {
	jobId: string;
	settingsHash: string;
	outputPath: string;
	clipJobId: string; // Database ClipJob ID
}

/**
 * Get resolution config based on block type and slot index
 */
function getResolutionConfig(blockType: BlockType, slotIndex: number): ResolutionConfig {
	switch (blockType) {
		case "ONE_COLUMN":
			return { maxDimension: 1920, bitrate: 8000000, name: "1080p" };
		case "TWO_COLUMN":
			return { maxDimension: 1280, bitrate: 5000000, name: "720p" };
		case "THREE_COLUMN":
		case "FOUR_COLUMN":
			return { maxDimension: 854, bitrate: 2500000, name: "480p" };
		case "ONE_TWO":
			return slotIndex === 0
				? { maxDimension: 854, bitrate: 2500000, name: "480p" }
				: { maxDimension: 1280, bitrate: 5000000, name: "720p" };
		case "TWO_ONE":
			return slotIndex === 0
				? { maxDimension: 1280, bitrate: 5000000, name: "720p" }
				: { maxDimension: 854, bitrate: 2500000, name: "480p" };
		default:
			return { maxDimension: 1280, bitrate: 5000000, name: "720p" };
	}
}

/**
 * Generate settings hash from crop and trim settings
 */
export function generateSettingsHash(cropSettings?: CropSettings, trimSettings?: TrimSettings): string {
	// Exclude aspectLabel from hash - it's display-only and shouldn't affect deduplication
	const cropForHash = cropSettings
		? {
				x: cropSettings.x,
				y: cropSettings.y,
				width: cropSettings.width,
				height: cropSettings.height,
				aspect: cropSettings.aspect,
			}
		: null;
	const data = JSON.stringify({ crop: cropForHash, trim: trimSettings || null });
	return createHash("md5").update(data).digest("hex").substring(0, 8);
}

/**
 * Convert crop settings from percentages to pixels
 * Also ensures values are even numbers (H.264 requirement)
 */
function convertCropToPixels(cropSettings: CropSettings, videoWidth: number, videoHeight: number): MediaConvertCrop {
	const makeEven = (n: number): number => Math.floor(n / 2) * 2;

	return {
		X: makeEven((cropSettings.x / 100) * videoWidth),
		Y: makeEven((cropSettings.y / 100) * videoHeight),
		Width: makeEven((cropSettings.width / 100) * videoWidth),
		Height: makeEven((cropSettings.height / 100) * videoHeight),
	};
}

/**
 * Convert seconds to MediaConvert timecode format (HH:MM:SS:FF)
 * Assumes 24fps for frame calculation
 */
function secondsToTimecode(seconds: number, fps: number = 24): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const frames = Math.floor((seconds % 1) * fps);

	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

/**
 * Calculate output dimensions maintaining aspect ratio
 * Ensures dimensions are even numbers
 */
function calculateOutputDimensions(
	cropWidth: number,
	cropHeight: number,
	maxDimension: number,
): { width: number; height: number } {
	const makeEven = (n: number): number => Math.floor(n / 2) * 2;
	const aspectRatio = cropWidth / cropHeight;

	let width: number;
	let height: number;

	if (cropWidth >= cropHeight) {
		// Landscape or square: width is max
		width = maxDimension;
		height = Math.round(maxDimension / aspectRatio);
	} else {
		// Portrait: height is max
		height = maxDimension;
		width = Math.round(maxDimension * aspectRatio);
	}

	return {
		width: makeEven(width),
		height: makeEven(height),
	};
}

/**
 * Clip Processing Service
 * Creates cropped/trimmed video clips using AWS MediaConvert
 */
export class ClipProcessingService {
	private client: MediaConvertClient | null = null;

	constructor() {
		if (isVideoProcessingConfigured()) {
			this.client = new MediaConvertClient({
				region: VIDEO_PROCESSING_CONFIG.s3.region,
				endpoint: VIDEO_PROCESSING_CONFIG.mediaConvert.endpoint,
			});
		}
	}

	/**
	 * Check if clip processing is available
	 */
	isAvailable(): boolean {
		return this.client !== null && isVideoProcessingConfigured();
	}

	/**
	 * Create a clip processing job with ClipJob tracking
	 */
	async createClipJob(params: {
		contextType?: string;
		contextId?: number;
		slotIndex?: number;
		blockType?: BlockType;
		mediaFileId: number;
		workId?: number; // Work ID for verification during updates
		cropSettings?: CropSettings;
		trimSettings?: TrimSettings;
		isDefault?: boolean; // For media library default clips
		mode?: "clip" | "thumbnail"; // "thumbnail" generates only a frame capture, no video
	}): Promise<ClipJobResult | null> {
		const {
			contextType,
			contextId,
			slotIndex,
			blockType,
			mediaFileId,
			workId,
			cropSettings,
			trimSettings,
			isDefault = false,
			mode = "clip",
		} = params;

		// For block clips, must have at least crop or trim settings
		// For default clips (media library), allow creation without crop/trim (re-encode only)
		if (!isDefault && !cropSettings && !trimSettings) {
			console.log("[ClipProcessing] No crop or trim settings, skipping");
			return null;
		}

		if (!this.client) {
			console.warn("[ClipProcessing] MediaConvert client not configured");
			return null;
		}

		// Get media file with metadata
		const mediaFile = await prisma.mediaFile.findUnique({
			where: { id: mediaFileId },
		});

		if (!mediaFile) {
			throw new Error(`Media file not found: ${mediaFileId}`);
		}

		// Get video metadata
		let metadata = mediaFile.metadata as VideoMetadata | null;

		// If no metadata but video is completed, try to use a default based on optimized URLs
		if (!metadata?.width || !metadata?.height) {
			const status = (mediaFile.processingStatus || "").toUpperCase();
			const optimizedUrls = mediaFile.optimizedUrls as Record<string, string> | null;

			// For completed videos with optimized URLs but no metadata (older videos),
			// assume 1920x1080 as default (most common upload resolution)
			if (status === "COMPLETED" && optimizedUrls && (optimizedUrls["1080p"] || optimizedUrls["720p"])) {
				console.log(
					`[ClipProcessing] Using default 1920x1080 for media file ${mediaFileId} (no metadata but has optimized URLs)`,
				);
				metadata = { width: 1920, height: 1080 };
			} else if (status === "PENDING" || status === "PROCESSING") {
				throw new Error(
					`Video is still processing (status: ${status}). Please wait for the original video to finish processing before applying crop/trim settings.`,
				);
			} else if (status === "FAILED") {
				throw new Error(`Video processing failed previously. Please re-upload the video or contact support.`);
			} else {
				throw new Error(
					`Video metadata not available for media file: ${mediaFileId}. The video may need to be re-processed.`,
				);
			}
		}

		// Generate settings hash (include mode to differentiate clip vs thumbnail)
		const settingsHash =
			mode === "thumbnail"
				? generateSettingsHash(cropSettings, trimSettings) + "t"
				: generateSettingsHash(cropSettings, trimSettings);

		// Get resolution config based on block type
		// For thumbnails, use higher resolution since it's a static image
		const resolutionConfig =
			mode === "thumbnail"
				? { maxDimension: 1920, bitrate: 8000000, name: "1080p" as const }
				: blockType && slotIndex !== undefined
					? getResolutionConfig(blockType, slotIndex)
					: { maxDimension: 1280, bitrate: 5000000, name: "720p" as const };

		// Build paths
		const { s3 } = VIDEO_PROCESSING_CONFIG;
		const videoUuid = mediaFile.uuid.split("/")[0];

		// Generate a stable filename from mediaFile (not workSlug which can change)
		const baseFilename = mediaFile.filename?.replace(/\.[^/.]+$/, "") || videoUuid;

		// Get optimized video URL for input (720p preferred, fallback to 1080p or original)
		// We need to know the input dimensions for crop calculation
		const optimizedUrls = mediaFile.optimizedUrls as Record<string, string> | null;
		let inputPath: string;
		let inputFilename: string;
		let inputWidth: number;
		let inputHeight: number;

		if (optimizedUrls?.["720p"]) {
			inputPath = `s3://${s3.bucket}/${optimizedUrls["720p"]}`;
			inputFilename =
				optimizedUrls["720p"]
					.split("/")
					.pop()
					?.replace(/\.mp4$/i, "") || baseFilename;
			// 720p is 1280x720 (16:9)
			inputWidth = 1280;
			inputHeight = 720;
		} else if (optimizedUrls?.["1080p"]) {
			inputPath = `s3://${s3.bucket}/${optimizedUrls["1080p"]}`;
			inputFilename =
				optimizedUrls["1080p"]
					.split("/")
					.pop()
					?.replace(/\.mp4$/i, "") || baseFilename;
			// 1080p is 1920x1080 (16:9)
			inputWidth = 1920;
			inputHeight = 1080;
		} else {
			inputPath = `s3://${s3.bucket}/${mediaFile.uuid}`;
			inputFilename =
				mediaFile.uuid
					.split("/")
					.pop()
					?.replace(/\.mp4$/i, "") || baseFilename;
			// Use original metadata for dimensions
			inputWidth = metadata.width;
			inputHeight = metadata.height;
		}

		// Calculate crop in pixels based on INPUT video dimensions (not original metadata)
		let cropPixels: MediaConvertCrop | undefined;
		let outputWidth: number;
		let outputHeight: number;

		if (cropSettings) {
			cropPixels = convertCropToPixels(cropSettings, inputWidth, inputHeight);
			// Calculate output dimensions based on crop area
			const outputDims = calculateOutputDimensions(cropPixels.Width, cropPixels.Height, resolutionConfig.maxDimension);
			outputWidth = outputDims.width;
			outputHeight = outputDims.height;
		} else {
			// No crop - use input aspect ratio
			const outputDims = calculateOutputDimensions(inputWidth, inputHeight, resolutionConfig.maxDimension);
			outputWidth = outputDims.width;
			outputHeight = outputDims.height;
		}

		// Output path: clips/{videoUUID}/{inputFilename}_{settingsHash}.mp4
		// MediaConvert appends NameModifier to the input filename, so we calculate accordingly
		const outputPath = `clips/${videoUuid}/${inputFilename}_${settingsHash}.mp4`;
		const s3OutputPath = `s3://${s3.bucket}/clips/${videoUuid}/`;

		// Get or create ClipJob record in database (deduplication happens here)
		const {
			clip: clipJob,
			isNew,
			reused,
		} = await clipJobService.getOrCreateClip({
			sourceMediaId: mediaFileId,
			contextType,
			contextId,
			slotIndex,
			workId,
			cropSettings,
			trimSettings,
			maxDimension: resolutionConfig.maxDimension,
			outputPath,
			isDefault,
			settingsHashOverride: settingsHash, // Pass hash with 't' suffix for thumbnail jobs
		});

		// If we got an existing completed job, return its data (cost savings!)
		if (reused && clipJob.status === ClipJobStatus.COMPLETED && clipJob.outputPath) {
			console.log(`[ClipProcessing] Reusing completed clip ${clipJob.id} - no MediaConvert job needed`);
			return {
				jobId: clipJob.id,
				settingsHash: clipJob.settingsHash,
				outputPath: clipJob.outputPath,
				clipJobId: clipJob.id,
			};
		}

		// If job is already pending/processing (not new), return it without creating new MediaConvert job
		if (!isNew && (clipJob.status === ClipJobStatus.PENDING || clipJob.status === ClipJobStatus.PROCESSING)) {
			console.log(`[ClipProcessing] Clip ${clipJob.id} already ${clipJob.status}, waiting for completion`);
			return {
				jobId: clipJob.mediaConvertJobId || clipJob.id,
				settingsHash: clipJob.settingsHash,
				outputPath: clipJob.outputPath || outputPath,
				clipJobId: clipJob.id,
			};
		}

		// Create MediaConvert job
		const mediaConvertJobId =
			mode === "thumbnail"
				? await this.createMediaConvertThumbnailJob({
						inputPath,
						outputPath: s3OutputPath,
						cropPixels,
						trimSettings,
						outputWidth,
						outputHeight,
						clipJobId: clipJob.id,
						settingsHash,
					})
				: await this.createMediaConvertClipJob({
						inputPath,
						outputPath: s3OutputPath,
						cropPixels,
						trimSettings,
						outputWidth,
						outputHeight,
						bitrate: resolutionConfig.bitrate,
						clipJobId: clipJob.id,
						settingsHash,
					});

		// Update ClipJob with MediaConvert job ID and mark as processing
		await clipJobService.markProcessing(clipJob.id, mediaConvertJobId);

		console.log(
			`[ClipProcessing] Started clip job ${clipJob.id} (MediaConvert: ${mediaConvertJobId}) for ${contextType}:${contextId}`,
		);

		return {
			jobId: mediaConvertJobId,
			settingsHash,
			outputPath,
			clipJobId: clipJob.id,
		};
	}

	/**
	 * Create MediaConvert job for clip with thumbnail generation
	 */
	private async createMediaConvertClipJob(params: {
		inputPath: string;
		outputPath: string;
		cropPixels?: MediaConvertCrop;
		trimSettings?: TrimSettings;
		outputWidth: number;
		outputHeight: number;
		bitrate: number;
		clipJobId: string;
		settingsHash: string;
	}): Promise<string> {
		if (!this.client) {
			throw new Error("MediaConvert client not configured");
		}

		const {
			inputPath,
			outputPath,
			cropPixels,
			trimSettings,
			outputWidth,
			outputHeight,
			bitrate,
			clipJobId,
			settingsHash,
		} = params;

		const { s3, mediaConvert } = VIDEO_PROCESSING_CONFIG;

		// Build input configuration (no audio for clips)
		const inputConfig: any = {
			FileInput: inputPath,
			VideoSelector: {},
			TimecodeSource: "ZEROBASED",
		};

		// Add trim (input clipping) if specified
		if (trimSettings) {
			inputConfig.InputClippings = [
				{
					StartTimecode: secondsToTimecode(trimSettings.startTime),
					EndTimecode: secondsToTimecode(trimSettings.endTime),
				},
			];
		}

		const jobInput: CreateJobCommandInput = {
			Role: mediaConvert.role,
			Queue: `arn:aws:mediaconvert:${s3.region}:${process.env.AWS_ACCOUNT_ID}:queues/${mediaConvert.queue}`,
			UserMetadata: {
				jobType: "clip",
				clipJobId,
				settingsHash,
			},
			Settings: {
				Inputs: [inputConfig],
				OutputGroups: [
					// Frame Capture for thumbnail - same name as video but .jpg
					{
						Name: "Clip Thumbnail",
						OutputGroupSettings: {
							Type: "FILE_GROUP_SETTINGS",
							FileGroupSettings: {
								Destination: outputPath,
							},
						},
						Outputs: [
							{
								NameModifier: `_${settingsHash}`,
								ContainerSettings: {
									Container: "RAW",
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "FRAME_CAPTURE",
										FrameCaptureSettings: {
											FramerateNumerator: 1,
											FramerateDenominator: 1,
											MaxCaptures: 1,
											Quality: 90,
										},
									},
									Width: outputWidth,
									Height: outputHeight,
									...(cropPixels && {
										Crop: {
											X: cropPixels.X,
											Y: cropPixels.Y,
											Width: cropPixels.Width,
											Height: cropPixels.Height,
										},
									}),
									ScalingBehavior: "STRETCH_TO_OUTPUT",
									AntiAlias: "ENABLED",
								},
							},
						],
					},
					// Video clip output
					{
						Name: "Clip Output",
						OutputGroupSettings: {
							Type: "FILE_GROUP_SETTINGS",
							FileGroupSettings: {
								Destination: outputPath,
							},
						},
						Outputs: [
							{
								NameModifier: `_${settingsHash}`,
								ContainerSettings: {
									Container: "MP4",
									Mp4Settings: {
										MoovPlacement: "PROGRESSIVE_DOWNLOAD", // Fast start
									},
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "H_264",
										H264Settings: {
											RateControlMode: "QVBR",
											QvbrSettings: {
												QvbrQualityLevel: 7,
											},
											MaxBitrate: bitrate,
											SceneChangeDetect: "TRANSITION_DETECTION",
										},
									},
									Width: outputWidth,
									Height: outputHeight,
									...(cropPixels && {
										Crop: {
											X: cropPixels.X,
											Y: cropPixels.Y,
											Width: cropPixels.Width,
											Height: cropPixels.Height,
										},
									}),
									ScalingBehavior: "STRETCH_TO_OUTPUT",
									AntiAlias: "ENABLED",
								},
								// No audio for clips
							},
						],
					},
				],
			},
			Tags: {
				Project: "platz",
				JobType: "clip",
				ClipJobId: clipJobId,
			},
		};

		const command = new CreateJobCommand(jobInput);
		const response = await this.client.send(command);

		if (!response.Job?.Id) {
			throw new Error("Failed to create MediaConvert clip job");
		}

		return response.Job.Id;
	}

	/**
	 * Create MediaConvert job for thumbnail-only generation (frame capture, no video output)
	 * Much faster and cheaper than a full clip job since only a single frame is extracted.
	 */
	private async createMediaConvertThumbnailJob(params: {
		inputPath: string;
		outputPath: string;
		cropPixels?: MediaConvertCrop;
		trimSettings?: TrimSettings;
		outputWidth: number;
		outputHeight: number;
		clipJobId: string;
		settingsHash: string;
	}): Promise<string> {
		if (!this.client) {
			throw new Error("MediaConvert client not configured");
		}

		const { inputPath, outputPath, cropPixels, trimSettings, outputWidth, outputHeight, clipJobId, settingsHash } =
			params;

		const { s3, mediaConvert } = VIDEO_PROCESSING_CONFIG;

		// Build input configuration — seek to the desired frame
		const inputConfig: any = {
			FileInput: inputPath,
			VideoSelector: {},
			TimecodeSource: "ZEROBASED",
		};

		// Use trimSettings to seek to the desired frame (startTime = frameTime)
		if (trimSettings) {
			const frameTime = trimSettings.startTime;
			// Capture a very short segment around the desired frame
			inputConfig.InputClippings = [
				{
					StartTimecode: secondsToTimecode(frameTime),
					EndTimecode: secondsToTimecode(frameTime + 0.04), // ~1 frame at 24fps
				},
			];
		}

		const jobInput: CreateJobCommandInput = {
			Role: mediaConvert.role,
			Queue: `arn:aws:mediaconvert:${s3.region}:${process.env.AWS_ACCOUNT_ID}:queues/${mediaConvert.queue}`,
			UserMetadata: {
				jobType: "clip",
				clipJobId,
				settingsHash,
			},
			Settings: {
				Inputs: [inputConfig],
				OutputGroups: [
					// Minimal video output — required by MediaConvert (cannot have frame capture only)
					{
						Name: "Minimal Video",
						OutputGroupSettings: {
							Type: "FILE_GROUP_SETTINGS",
							FileGroupSettings: {
								Destination: outputPath,
							},
						},
						Outputs: [
							{
								NameModifier: `_${settingsHash}_min`,
								ContainerSettings: {
									Container: "MP4",
									Mp4Settings: {},
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "H_264",
										H264Settings: {
											RateControlMode: "QVBR",
											QvbrSettings: {
												QvbrQualityLevel: 1, // lowest quality
											},
											MaxBitrate: 100000, // 100kbps — tiny file
										},
									},
									Width: 320,
									Height: 240,
								},
							},
						],
					},
					// Frame Capture — actual thumbnail output
					{
						Name: "Thumbnail Output",
						OutputGroupSettings: {
							Type: "FILE_GROUP_SETTINGS",
							FileGroupSettings: {
								Destination: outputPath,
							},
						},
						Outputs: [
							{
								NameModifier: `_${settingsHash}`,
								ContainerSettings: {
									Container: "RAW",
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "FRAME_CAPTURE",
										FrameCaptureSettings: {
											FramerateNumerator: 1,
											FramerateDenominator: 1,
											MaxCaptures: 1,
											Quality: 95,
										},
									},
									Width: outputWidth,
									Height: outputHeight,
									...(cropPixels && {
										Crop: {
											X: cropPixels.X,
											Y: cropPixels.Y,
											Width: cropPixels.Width,
											Height: cropPixels.Height,
										},
									}),
									ScalingBehavior: "STRETCH_TO_OUTPUT",
									AntiAlias: "ENABLED",
								},
							},
						],
					},
				],
			},
			Tags: {
				Project: "platz",
				JobType: "thumbnail",
				ClipJobId: clipJobId,
			},
		};

		const command = new CreateJobCommand(jobInput);
		const response = await this.client.send(command);

		if (!response.Job?.Id) {
			throw new Error("Failed to create MediaConvert thumbnail job");
		}

		return response.Job.Id;
	}

	/**
	 * Handle clip job completion (called from webhook)
	 * Uses DB as source of truth - ignores unreliable userMetadata
	 */
	async handleClipJobComplete(
		mediaConvertJobId: string,
		status: "COMPLETE" | "ERROR",
		userMetadata: { clipJobId?: string; blockId?: string; slotIndex?: string; settingsHash?: string; jobType?: string },
		errorMessage?: string,
	): Promise<void> {
		// DB-FIRST: Always look up ClipJob from database by MediaConvert job ID
		// This is the source of truth - userMetadata can be missing or outdated
		const clipJob = await clipJobService.findByMediaConvertJobId(mediaConvertJobId);

		if (!clipJob) {
			// Fallback to clipJobId from userMetadata (in case of race condition where MediaConvert ID wasn't saved yet)
			const { clipJobId } = userMetadata;
			if (clipJobId) {
				const fallbackJob = await clipJobService.getJob(clipJobId);
				if (fallbackJob) {
					console.log(`[ClipProcessing] Found job by clipJobId fallback: ${clipJobId}`);
					// Update the MediaConvert job ID if it was missing
					if (!fallbackJob.mediaConvertJobId) {
						await clipJobService.markProcessing(clipJobId, mediaConvertJobId);
					}
					// Recursively call with the found job
					return this.handleClipJobComplete(mediaConvertJobId, status, userMetadata, errorMessage);
				}
			}

			console.error(`[ClipProcessing] ClipJob not found for MediaConvert job: ${mediaConvertJobId}`);
			return;
		}

		// Use the settings hash from the database record
		const jobSettingsHash = clipJob.settingsHash;

		if (status === "COMPLETE") {
			// Use outputPath only - CDN domain will be added dynamically when serving
			const { cloudfront } = VIDEO_PROCESSING_CONFIG;
			const outputPath = clipJob.outputPath || `clips/${clipJob.sourceMediaId}/${jobSettingsHash}.mp4`;

			// Detect if this is a thumbnail-only job (settings hash ends with 't')
			const isThumbnailJob = jobSettingsHash.endsWith("t");

			// Thumbnail path: same as video but .jpg extension (MediaConvert adds .0000000 before extension for first frame)
			// Video: clips/{videoUuid}/{inputFilename}_{settingsHash}.mp4
			// Thumbnail: clips/{videoUuid}/{inputFilename}_{settingsHash}.0000000.jpg
			const thumbnailPath = outputPath.replace(/\.mp4$/, ".0000000.jpg");

			// Update ClipJob as completed with thumbnail path
			await clipJobService.markCompleted(clipJob.id, outputPath, thumbnailPath);

			// Build full URLs for immediate use (block update)
			const outputUrl = `https://${cloudfront.domain}/${outputPath}`;
			const thumbnailUrl = `https://${cloudfront.domain}/${thumbnailPath}`;
			console.log(
				`[ClipProcessing] ${isThumbnailJob ? "Thumbnail" : "Clip"} job ${clipJob.id} completed. Path: ${outputPath}, Thumbnail: ${thumbnailPath}`,
			);

			// Also update the block content if this is a block context
			if (clipJob.contextType === "block" && clipJob.contextId) {
				if (isThumbnailJob) {
					// Thumbnail-only job: update generatedThumbnail field
					await this.updateBlockWithGeneratedThumbnail(
						clipJob.contextId,
						clipJob.slotIndex || 0,
						clipJob.workId || undefined,
						{
							status: ClipProcessingStatus.COMPLETED,
							url: thumbnailUrl,
							settingsHash: jobSettingsHash,
							clipJobId: clipJob.id,
						},
					);
				} else {
					// Regular clip job: update processedVideo field
					await this.updateBlockWithCompletedClip(
						clipJob.contextId,
						clipJob.slotIndex || 0,
						clipJob.workId || undefined,
						{
							status: ClipProcessingStatus.COMPLETED,
							url: outputUrl,
							thumbnailUrl,
							settingsHash: jobSettingsHash,
							clipJobId: clipJob.id,
						},
					);
				}

				// Broadcast SSE update to connected clients
				const broadcast = getBroadcastFunction();
				if (broadcast) {
					broadcast(clipJob.contextId, {
						type: isThumbnailJob ? "thumbnail_complete" : "clip_complete",
						slotIndex: clipJob.slotIndex || 0,
						clipJobId: clipJob.id,
						status: "COMPLETED",
						outputPath,
						thumbnailPath,
						outputUrl,
						thumbnailUrl,
					});
				}
			}
		} else {
			// Mark as failed
			await clipJobService.markFailed(clipJob.id, errorMessage || "Unknown error");

			const isThumbnailJob = jobSettingsHash.endsWith("t");
			console.error(
				`[ClipProcessing] ${isThumbnailJob ? "Thumbnail" : "Clip"} job ${clipJob.id} failed: ${errorMessage}`,
			);

			// Update block content with failure if block context
			if (clipJob.contextType === "block" && clipJob.contextId) {
				if (isThumbnailJob) {
					await this.updateBlockWithGeneratedThumbnail(
						clipJob.contextId,
						clipJob.slotIndex || 0,
						clipJob.workId || undefined,
						{
							status: ClipProcessingStatus.FAILED,
							error: errorMessage || "Unknown error",
							settingsHash: jobSettingsHash,
							clipJobId: clipJob.id,
						},
					);
				} else {
					await this.updateBlockWithCompletedClip(
						clipJob.contextId,
						clipJob.slotIndex || 0,
						clipJob.workId || undefined,
						{
							status: ClipProcessingStatus.FAILED,
							error: errorMessage || "Unknown error",
							settingsHash: jobSettingsHash,
							clipJobId: clipJob.id,
						},
					);
				}

				// Broadcast SSE failure to connected clients
				const broadcast = getBroadcastFunction();
				if (broadcast) {
					broadcast(clipJob.contextId, {
						type: isThumbnailJob ? "thumbnail_failed" : "clip_failed",
						slotIndex: clipJob.slotIndex || 0,
						clipJobId: clipJob.id,
						status: "FAILED",
						error: errorMessage || "Unknown error",
					});
				}
			}
		}
	}

	/**
	 * Update block content with completed/failed clip info
	 * Includes workId verification to prevent wrong-work updates
	 */
	private async updateBlockWithCompletedClip(
		blockId: number,
		targetSlotIndex: number,
		expectedWorkId: number | undefined,
		clipData: {
			status: ClipProcessingStatus;
			url?: string;
			thumbnailUrl?: string;
			error?: string;
			settingsHash: string;
			clipJobId: string;
		},
	): Promise<void> {
		const block = await prisma.block.findUnique({
			where: { id: blockId },
		});

		if (!block) {
			console.error(`[ClipProcessing] Block not found: ${blockId}`);
			return;
		}

		const content = block.content as any;
		const items = content?.items || [];

		// First try the expected slot index
		let slotIndex = targetSlotIndex;
		let item = items[slotIndex];

		// Verify workId if provided
		if (expectedWorkId && item?.workId !== expectedWorkId) {
			console.log(
				`[ClipProcessing] WorkId mismatch at slot ${slotIndex} - expected: ${expectedWorkId}, found: ${item?.workId}. Searching other slots...`,
			);

			// Search for the correct slot by workId and clipJobId
			let foundSlot = false;
			for (let i = 0; i < items.length; i++) {
				const searchItem = items[i];
				// Match by workId or by clipJobId in processedVideo
				if (searchItem?.workId === expectedWorkId || searchItem?.processedVideo?.clipJobId === clipData.clipJobId) {
					console.log(`[ClipProcessing] Found matching slot at index ${i} for workId: ${expectedWorkId}`);
					slotIndex = i;
					item = searchItem;
					foundSlot = true;
					break;
				}
			}

			if (!foundSlot) {
				console.warn(
					`[ClipProcessing] Could not find slot for workId: ${expectedWorkId} in block: ${blockId}. Work may have been removed from block.`,
				);
				// Still update ClipJob in database, just skip block update
				return;
			}
		}

		if (!item) {
			console.error(`[ClipProcessing] Slot ${slotIndex} not found in block ${blockId}`);
			return;
		}

		// Update processedVideo in item
		item.processedVideo = {
			...item.processedVideo,
			...clipData,
			completedAt: new Date().toISOString(),
		};

		await prisma.block.update({
			where: { id: blockId },
			data: {
				content: { ...content, items },
			},
		});

		console.log(`[ClipProcessing] Updated block ${blockId} slot ${slotIndex} with clip ${clipData.clipJobId}`);
	}

	/**
	 * Update block content with generated thumbnail info
	 * Similar to updateBlockWithCompletedClip but updates generatedThumbnail field instead of processedVideo
	 */
	private async updateBlockWithGeneratedThumbnail(
		blockId: number,
		targetSlotIndex: number,
		expectedWorkId: number | undefined,
		thumbnailData: {
			status: ClipProcessingStatus;
			url?: string;
			error?: string;
			settingsHash: string;
			clipJobId: string;
		},
	): Promise<void> {
		const block = await prisma.block.findUnique({
			where: { id: blockId },
		});

		if (!block) {
			console.error(`[ClipProcessing] Block not found: ${blockId}`);
			return;
		}

		const content = block.content as any;
		const items = content?.items || [];

		// First try the expected slot index
		let slotIndex = targetSlotIndex;
		let item = items[slotIndex];

		// Verify workId if provided
		if (expectedWorkId && item?.workId !== expectedWorkId) {
			let foundSlot = false;
			for (let i = 0; i < items.length; i++) {
				const searchItem = items[i];
				if (
					searchItem?.workId === expectedWorkId ||
					searchItem?.generatedThumbnail?.clipJobId === thumbnailData.clipJobId
				) {
					slotIndex = i;
					item = searchItem;
					foundSlot = true;
					break;
				}
			}

			if (!foundSlot) {
				console.warn(
					`[ClipProcessing] Could not find slot for workId: ${expectedWorkId} in block: ${blockId} for thumbnail update.`,
				);
				return;
			}
		}

		if (!item) {
			console.error(`[ClipProcessing] Slot ${slotIndex} not found in block ${blockId}`);
			return;
		}

		// Update generatedThumbnail in item
		item.generatedThumbnail = {
			...item.generatedThumbnail,
			...thumbnailData,
			completedAt: new Date().toISOString(),
		};

		await prisma.block.update({
			where: { id: blockId },
			data: {
				content: { ...content, items },
			},
		});

		console.log(
			`[ClipProcessing] Updated block ${blockId} slot ${slotIndex} with generated thumbnail ${thumbnailData.clipJobId}`,
		);
	}
}

// Export singleton instance
export const clipProcessingService = new ClipProcessingService();
