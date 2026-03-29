import {
	MediaConvertClient,
	CreateJobCommand,
	GetJobCommand,
	CreateJobCommandInput,
	JobStatus,
} from "@aws-sdk/client-mediaconvert";
import { prisma } from "../config/database";
import {
	VIDEO_PROCESSING_CONFIG,
	VideoProcessingStatus,
	isProcessableVideo,
	isVideoProcessingConfigured,
	getOptimizedVideoUrl,
	getHlsUrl,
} from "../config/videoProcessing";

/**
 * Video Processing Service
 * Handles AWS MediaConvert job creation and status tracking
 */
export class VideoProcessingService {
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
	 * Check if video processing is available
	 */
	isAvailable(): boolean {
		return this.client !== null && isVideoProcessingConfigured();
	}

	/**
	 * Start processing a video file
	 */
	async startProcessing(mediaFileId: number): Promise<string | null> {
		if (!this.client) {
			console.warn("[VideoProcessing] MediaConvert client not configured");
			return null;
		}

		// Get media file from database
		const mediaFile = await prisma.mediaFile.findUnique({
			where: { id: mediaFileId },
		});

		if (!mediaFile) {
			throw new Error(`Media file not found: ${mediaFileId}`);
		}

		// Validate it's a video
		if (!isProcessableVideo(mediaFile.mimeType)) {
			console.log(`[VideoProcessing] Skipping non-video file: ${mediaFile.mimeType}`);
			return null;
		}

		// Check file size thresholds
		const fileSize = Number(mediaFile.size);
		const { maxSizeBytes } = VIDEO_PROCESSING_CONFIG.thresholds;

		if (fileSize > maxSizeBytes) {
			throw new Error(`File too large for processing: ${fileSize} bytes (max: ${maxSizeBytes})`);
		}

		// Create MediaConvert job
		const jobId = await this.createMediaConvertJob(mediaFile.uuid);

		// Update database with processing status
		await prisma.mediaFile.update({
			where: { id: mediaFileId },
			data: {
				processingStatus: VideoProcessingStatus.PENDING,
				processingJobId: jobId,
				processingStartedAt: new Date(),
				processingError: null,
			},
		});

		console.log(`[VideoProcessing] Started job ${jobId} for media file ${mediaFileId}`);
		return jobId;
	}

	/**
	 * Create MediaConvert job
	 */
	private async createMediaConvertJob(uuid: string): Promise<string> {
		if (!this.client) {
			throw new Error("MediaConvert client not configured");
		}

		const { s3, mediaConvert, outputs, hls } = VIDEO_PROCESSING_CONFIG;
		const inputPath = `s3://${s3.bucket}/${uuid}`;
		const outputPath = `s3://${s3.bucket}/${s3.outputPrefix}/${uuid.split("/")[0]}`;

		// Extract just the UUID part (without filename) for output naming
		const uuidPart = uuid.split("/")[0];

		// Thumbnail goes to the same folder as the original video (not optimized folder)
		const thumbnailOutputPath = `s3://${s3.bucket}/${uuidPart}`;

		// Generate a timestamp for thumbnail filename (matching manual upload format)
		const thumbnailTimestamp = Date.now();

		const jobInput: CreateJobCommandInput = {
			Role: mediaConvert.role,
			Queue: `arn:aws:mediaconvert:${s3.region}:${process.env.AWS_ACCOUNT_ID}:queues/${mediaConvert.queue}`,
			// Store timestamp in UserMetadata for retrieval in job completion handler
			UserMetadata: {
				thumbnailTimestamp: thumbnailTimestamp.toString(),
			},
			Settings: {
				Inputs: [
					{
						FileInput: inputPath,
						AudioSelectors: {
							"Audio Selector 1": {
								DefaultSelection: "DEFAULT",
							},
						},
						VideoSelector: {},
						TimecodeSource: "ZEROBASED",
					},
				],
				OutputGroups: [
					// Frame Capture for thumbnail - goes to video's own folder
					{
						Name: "Thumbnail",
						OutputGroupSettings: {
							Type: "FILE_GROUP_SETTINGS",
							FileGroupSettings: {
								Destination: `${thumbnailOutputPath}/thumbnail-${thumbnailTimestamp}`,
							},
						},
						Outputs: [
							{
								// NameModifier is required but we use destination for naming
								// MediaConvert will output: thumbnail-{timestamp}.0000001.jpg
								NameModifier: "_frame",
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
									Width: 1280,
									Height: 720,
									ScalingBehavior: "DEFAULT",
									AntiAlias: "ENABLED",
								},
							},
						],
					},
					// MP4 outputs (1080p, 720p, 480p)
					{
						Name: "MP4 Group",
						OutputGroupSettings: {
							Type: "FILE_GROUP_SETTINGS",
							FileGroupSettings: {
								Destination: `${outputPath}/mp4/`,
							},
						},
						Outputs: [
							// 1080p
							{
								NameModifier: "_1080p",
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
												QvbrQualityLevel: 8,
											},
											MaxBitrate: outputs["1080p"].bitrate,
											SceneChangeDetect: "TRANSITION_DETECTION",
										},
									},
									Width: outputs["1080p"].width,
									Height: outputs["1080p"].height,
									ScalingBehavior: "DEFAULT",
									AntiAlias: "ENABLED",
								},
								AudioDescriptions: [
									{
										CodecSettings: {
											Codec: "AAC",
											AacSettings: {
												Bitrate: 128000,
												CodingMode: "CODING_MODE_2_0",
												SampleRate: 48000,
											},
										},
									},
								],
							},
							// 720p
							{
								NameModifier: "_720p",
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
												QvbrQualityLevel: 7,
											},
											MaxBitrate: outputs["720p"].bitrate,
											SceneChangeDetect: "TRANSITION_DETECTION",
										},
									},
									Width: outputs["720p"].width,
									Height: outputs["720p"].height,
									ScalingBehavior: "DEFAULT",
									AntiAlias: "ENABLED",
								},
								AudioDescriptions: [
									{
										CodecSettings: {
											Codec: "AAC",
											AacSettings: {
												Bitrate: 128000,
												CodingMode: "CODING_MODE_2_0",
												SampleRate: 48000,
											},
										},
									},
								],
							},
							// 480p
							{
								NameModifier: "_480p",
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
												QvbrQualityLevel: 6,
											},
											MaxBitrate: outputs["480p"].bitrate,
											SceneChangeDetect: "TRANSITION_DETECTION",
										},
									},
									Width: outputs["480p"].width,
									Height: outputs["480p"].height,
									ScalingBehavior: "DEFAULT",
									AntiAlias: "ENABLED",
								},
								AudioDescriptions: [
									{
										CodecSettings: {
											Codec: "AAC",
											AacSettings: {
												Bitrate: 96000,
												CodingMode: "CODING_MODE_2_0",
												SampleRate: 48000,
											},
										},
									},
								],
							},
						],
					},
					// HLS output for adaptive streaming
					{
						Name: "HLS Group",
						OutputGroupSettings: {
							Type: "HLS_GROUP_SETTINGS",
							HlsGroupSettings: {
								Destination: `${outputPath}/hls/`,
								SegmentLength: hls.segmentDuration,
								MinSegmentLength: 0,
								SegmentControl: "SEGMENTED_FILES",
								ManifestCompression: "NONE",
								DirectoryStructure: "SINGLE_DIRECTORY",
							},
						},
						Outputs: [
							// 1080p HLS
							{
								NameModifier: "_1080p",
								OutputSettings: {
									HlsSettings: {},
								},
								ContainerSettings: {
									Container: "M3U8",
									M3u8Settings: {},
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "H_264",
										H264Settings: {
											RateControlMode: "QVBR",
											QvbrSettings: {
												QvbrQualityLevel: 8,
											},
											MaxBitrate: outputs["1080p"].bitrate,
										},
									},
									Width: outputs["1080p"].width,
									Height: outputs["1080p"].height,
								},
								AudioDescriptions: [
									{
										CodecSettings: {
											Codec: "AAC",
											AacSettings: {
												Bitrate: 128000,
												CodingMode: "CODING_MODE_2_0",
												SampleRate: 48000,
											},
										},
									},
								],
							},
							// 720p HLS
							{
								NameModifier: "_720p",
								OutputSettings: {
									HlsSettings: {},
								},
								ContainerSettings: {
									Container: "M3U8",
									M3u8Settings: {},
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "H_264",
										H264Settings: {
											RateControlMode: "QVBR",
											QvbrSettings: {
												QvbrQualityLevel: 7,
											},
											MaxBitrate: outputs["720p"].bitrate,
										},
									},
									Width: outputs["720p"].width,
									Height: outputs["720p"].height,
								},
								AudioDescriptions: [
									{
										CodecSettings: {
											Codec: "AAC",
											AacSettings: {
												Bitrate: 128000,
												CodingMode: "CODING_MODE_2_0",
												SampleRate: 48000,
											},
										},
									},
								],
							},
							// 480p HLS
							{
								NameModifier: "_480p",
								OutputSettings: {
									HlsSettings: {},
								},
								ContainerSettings: {
									Container: "M3U8",
									M3u8Settings: {},
								},
								VideoDescription: {
									CodecSettings: {
										Codec: "H_264",
										H264Settings: {
											RateControlMode: "QVBR",
											QvbrSettings: {
												QvbrQualityLevel: 6,
											},
											MaxBitrate: outputs["480p"].bitrate,
										},
									},
									Width: outputs["480p"].width,
									Height: outputs["480p"].height,
								},
								AudioDescriptions: [
									{
										CodecSettings: {
											Codec: "AAC",
											AacSettings: {
												Bitrate: 96000,
												CodingMode: "CODING_MODE_2_0",
												SampleRate: 48000,
											},
										},
									},
								],
							},
						],
					},
				],
			},
			// Tags for tracking
			Tags: {
				Project: "platz",
				MediaFileUuid: uuid,
			},
		};

		const command = new CreateJobCommand(jobInput);
		const response = await this.client.send(command);

		if (!response.Job?.Id) {
			throw new Error("Failed to create MediaConvert job");
		}

		return response.Job.Id;
	}

	/**
	 * Handle job completion callback (called from webhook)
	 * @param jobId MediaConvert job ID
	 * @param status Job status (COMPLETE or ERROR)
	 * @param errorMessage Error message if status is ERROR
	 * @param userMetadata Optional metadata from job (contains thumbnailTimestamp)
	 * @param videoMetadata Optional video metadata (width, height, duration)
	 */
	async handleJobComplete(
		jobId: string,
		status: "COMPLETE" | "ERROR",
		errorMessage?: string,
		userMetadata?: { thumbnailTimestamp?: string },
		videoMetadata?: { width?: number; height?: number; duration?: number },
	): Promise<void> {
		// Find media file by job ID
		const mediaFile = await prisma.mediaFile.findFirst({
			where: { processingJobId: jobId },
		});

		if (!mediaFile) {
			console.error(`[VideoProcessing] Media file not found for job: ${jobId}`);
			return;
		}

		// uuid format: "uuid/filename.mp4" - extract both parts
		const uuidParts = mediaFile.uuid.split("/");
		const uuidPart = uuidParts[0];
		// MediaConvert uses original filename (without extension) for output naming
		const originalFilename =
			uuidParts.length > 1
				? uuidParts[1].replace(/\.[^/.]+$/, "") // Remove extension from filename
				: uuidPart;

		if (status === "COMPLETE") {
			// Build optimized paths (without domain - URL will be generated at runtime)
			const outputPrefix = VIDEO_PROCESSING_CONFIG.s3.outputPrefix;

			const optimizedPaths = {
				"1080p": `${outputPrefix}/${uuidPart}/mp4/${originalFilename}_1080p.mp4`,
				"720p": `${outputPrefix}/${uuidPart}/mp4/${originalFilename}_720p.mp4`,
				"480p": `${outputPrefix}/${uuidPart}/mp4/${originalFilename}_480p.mp4`,
			};

			const hlsPath = `${outputPrefix}/${uuidPart}/hls/${originalFilename}.m3u8`;

			// Thumbnail path - format: {uuid}/thumbnail-{timestamp}_frame.0000000.jpg
			// MediaConvert adds NameModifier (_frame) and frame number (.0000000.jpg - zero-indexed) to output
			const thumbnailTimestamp = userMetadata?.thumbnailTimestamp || Date.now().toString();
			const thumbnailPath = `${uuidPart}/thumbnail-${thumbnailTimestamp}_frame.0000000.jpg`;

			// Build metadata object for video
			const metadata = videoMetadata
				? {
						width: videoMetadata.width,
						height: videoMetadata.height,
						duration: videoMetadata.duration,
					}
				: null;

			await prisma.mediaFile.update({
				where: { id: mediaFile.id },
				data: {
					processingStatus: VideoProcessingStatus.COMPLETED,
					processingCompletedAt: new Date(),
					hlsUrl: hlsPath,
					optimizedVideoUrl: optimizedPaths["1080p"],
					optimizedUrls: optimizedPaths,
					thumbnailPath: thumbnailPath,
					thumbnailTime: 1, // Captured at 1 second
					processingError: null,
					...(metadata && { metadata }),
				},
			});

			console.log(
				`[VideoProcessing] Job ${jobId} completed successfully. Thumbnail: ${thumbnailPath}${metadata ? `, Metadata: ${metadata.width}x${metadata.height}` : ""}`,
			);
		} else {
			await prisma.mediaFile.update({
				where: { id: mediaFile.id },
				data: {
					processingStatus: VideoProcessingStatus.FAILED,
					processingCompletedAt: new Date(),
					processingError: errorMessage || "Unknown error",
				},
			});

			console.error(`[VideoProcessing] Job ${jobId} failed: ${errorMessage}`);
		}
	}

	/**
	 * Get processing status for a media file
	 */
	async getProcessingStatus(mediaFileId: number): Promise<{
		status: string | null;
		progress?: number;
		error?: string;
	}> {
		const mediaFile = await prisma.mediaFile.findUnique({
			where: { id: mediaFileId },
			select: {
				processingStatus: true,
				processingError: true,
				processingJobId: true,
			},
		});

		if (!mediaFile) {
			return { status: null };
		}

		// If processing, try to get progress from MediaConvert
		if (mediaFile.processingStatus === VideoProcessingStatus.PROCESSING && mediaFile.processingJobId) {
			try {
				const progress = await this.getJobProgress(mediaFile.processingJobId);
				return {
					status: mediaFile.processingStatus,
					progress,
				};
			} catch (e) {
				// Ignore errors, just return status
			}
		}

		return {
			status: mediaFile.processingStatus,
			error: mediaFile.processingError || undefined,
		};
	}

	/**
	 * Get job progress from MediaConvert
	 */
	private async getJobProgress(jobId: string): Promise<number | undefined> {
		if (!this.client) return undefined;

		try {
			const command = new GetJobCommand({ Id: jobId });
			const response = await this.client.send(command);

			if (response.Job?.JobPercentComplete) {
				return response.Job.JobPercentComplete;
			}
		} catch (e) {
			console.error(`[VideoProcessing] Error getting job progress: ${e}`);
		}

		return undefined;
	}

	/**
	 * Retry failed processing
	 */
	async retryProcessing(mediaFileId: number): Promise<string | null> {
		const mediaFile = await prisma.mediaFile.findUnique({
			where: { id: mediaFileId },
		});

		if (!mediaFile) {
			throw new Error(`Media file not found: ${mediaFileId}`);
		}

		if (mediaFile.processingStatus !== VideoProcessingStatus.FAILED) {
			throw new Error("Can only retry failed jobs");
		}

		return this.startProcessing(mediaFileId);
	}
}

// Export singleton instance
export const videoProcessingService = new VideoProcessingService();
