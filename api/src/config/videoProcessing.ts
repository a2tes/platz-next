import { config } from "dotenv";

config();

/**
 * Video Processing Configuration
 * AWS MediaConvert settings for video optimization pipeline
 */

export const VIDEO_PROCESSING_CONFIG = {
	// Enable/disable video processing
	enabled: process.env.VIDEO_PROCESSING_ENABLED === "true",

	// AWS MediaConvert settings
	mediaConvert: {
		endpoint: process.env.AWS_MEDIACONVERT_ENDPOINT || "",
		role: process.env.AWS_MEDIACONVERT_ROLE || "",
		queue: process.env.AWS_MEDIACONVERT_QUEUE || "Default",
	},

	// S3 paths
	s3: {
		bucket: process.env.AWS_S3_BUCKET || "",
		region: process.env.AWS_REGION || "eu-central-1",
		// Input: where original uploads go
		inputPrefix: "", // Root of bucket (existing behavior)
		// Output: where optimized videos go
		outputPrefix: "optimized",
	},

	// CloudFront distribution
	cloudfront: {
		domain: process.env.NEXT_PUBLIC_CLOUDFRONT_URL || "",
	},

	// SNS topic for job completion notifications
	sns: {
		topicArn: process.env.AWS_SNS_MEDIACONVERT_TOPIC || "",
	},

	// Video output presets
	outputs: {
		// 1080p output
		"1080p": {
			width: 1920,
			height: 1080,
			bitrate: 8000000, // 8 Mbps
			suffix: "_1080p",
		},
		// 720p output
		"720p": {
			width: 1280,
			height: 720,
			bitrate: 5000000, // 5 Mbps
			suffix: "_720p",
		},
		// 480p output (mobile)
		"480p": {
			width: 854,
			height: 480,
			bitrate: 2500000, // 2.5 Mbps
			suffix: "_480p",
		},
	},

	// HLS settings
	hls: {
		segmentDuration: 6, // seconds per segment
		playlistType: "VOD",
	},

	// Processing thresholds
	thresholds: {
		// Minimum file size to trigger processing (skip tiny videos)
		minSizeBytes: 1 * 1024 * 1024, // 1 MB
		// Maximum input file size
		maxSizeBytes: 5 * 1024 * 1024 * 1024, // 5 GB
	},

	// Original file retention (S3 Lifecycle will handle deletion)
	retention: {
		// Days to keep original after processing completes
		originalRetentionDays: 7,
	},
};

/**
 * Video processing status enum
 */
export enum VideoProcessingStatus {
	PENDING = "pending",
	PROCESSING = "processing",
	COMPLETED = "completed",
	FAILED = "failed",
}

/**
 * Supported video MIME types for processing
 */
export const PROCESSABLE_VIDEO_TYPES = [
	"video/mp4",
	"video/quicktime",
	"video/x-msvideo",
	"video/x-ms-wmv",
	"video/webm",
	"video/mpeg",
	"video/x-matroska",
];

/**
 * Check if a MIME type is a processable video
 */
export function isProcessableVideo(mimeType: string): boolean {
	return PROCESSABLE_VIDEO_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Check if video processing is properly configured
 */
export function isVideoProcessingConfigured(): boolean {
	const { mediaConvert, s3, sns } = VIDEO_PROCESSING_CONFIG;
	return !!(VIDEO_PROCESSING_CONFIG.enabled && mediaConvert.endpoint && mediaConvert.role && s3.bucket && sns.topicArn);
}

/**
 * Get S3 output path for processed video
 */
export function getOutputPath(uuid: string, quality: string): string {
	const { outputPrefix } = VIDEO_PROCESSING_CONFIG.s3;
	return `${outputPrefix}/${uuid}/${quality}`;
}

/**
 * Get CloudFront URL for processed video
 */
export function getOptimizedVideoUrl(uuid: string, quality: string, filename: string): string {
	const { domain } = VIDEO_PROCESSING_CONFIG.cloudfront;
	const { outputPrefix } = VIDEO_PROCESSING_CONFIG.s3;
	return `https://${domain}/${outputPrefix}/${uuid}/${quality}/${filename}`;
}

/**
 * Get HLS master playlist URL
 */
export function getHlsUrl(uuid: string): string {
	const { domain } = VIDEO_PROCESSING_CONFIG.cloudfront;
	const { outputPrefix } = VIDEO_PROCESSING_CONFIG.s3;
	return `https://${domain}/${outputPrefix}/${uuid}/hls/master.m3u8`;
}

/**
 * Get thumbnail URL for processed video
 */
export function getThumbnailUrl(thumbnailPath: string): string {
	const { domain } = VIDEO_PROCESSING_CONFIG.cloudfront;
	return `https://${domain}/${thumbnailPath}`;
}
