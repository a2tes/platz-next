import { S3Event, Context, Callback } from "aws-lambda";
import { MediaConvertClient, CreateJobCommand, CreateJobCommandInput } from "@aws-sdk/client-mediaconvert";

/**
 * Environment variables (set in Lambda configuration)
 */
const AWS_MEDIACONVERT_ENDPOINT = process.env.AWS_MEDIACONVERT_ENDPOINT!;
const AWS_MEDIACONVERT_ROLE = process.env.AWS_MEDIACONVERT_ROLE!;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET || process.env.INPUT_BUCKET!;
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "optimized";
const REGION = process.env.AWS_REGION || "eu-central-1";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

/**
 * Supported video MIME types
 */
const PROCESSABLE_EXTENSIONS = [".mp4", ".mov", ".avi", ".wmv", ".webm", ".mpeg", ".mkv"];

/**
 * Video output presets
 */
const OUTPUT_PRESETS = {
	"1080p": { width: 1920, height: 1080, bitrate: 8000000 },
	"720p": { width: 1280, height: 720, bitrate: 5000000 },
	"480p": { width: 854, height: 480, bitrate: 2500000 },
};

/**
 * Lambda handler - triggered by S3 ObjectCreated event
 */
export const handler = async (event: S3Event, context: Context, callback: Callback) => {
	console.log("Received S3 event:", JSON.stringify(event, null, 2));

	const mediaConvert = new MediaConvertClient({
		region: REGION,
		endpoint: AWS_MEDIACONVERT_ENDPOINT,
	});

	for (const record of event.Records) {
		const bucket = record.s3.bucket.name;
		const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
		const size = record.s3.object.size;

		console.log(`Processing: s3://${bucket}/${key} (${size} bytes)`);

		// Check if it's a video file
		const ext = key.substring(key.lastIndexOf(".")).toLowerCase();
		if (!PROCESSABLE_EXTENSIONS.includes(ext)) {
			console.log(`Skipping non-video file: ${key}`);
			continue;
		}

		// Skip already processed files (in optimized folder)
		if (key.startsWith(OUTPUT_PREFIX + "/")) {
			console.log(`Skipping already processed file: ${key}`);
			continue;
		}

		// Skip small files (< 1MB)
		if (size < 1024 * 1024) {
			console.log(`Skipping small file: ${key} (${size} bytes)`);
			continue;
		}

		// Extract UUID from key (format: uuid/filename.ext)
		const uuidMatch = key.match(/^([a-f0-9-]{36})\//);
		if (!uuidMatch) {
			console.log(`Skipping file without UUID prefix: ${key}`);
			continue;
		}
		const uuid = uuidMatch[1];

		try {
			const jobId = await createMediaConvertJob(mediaConvert, bucket, key, uuid);
			console.log(`Created MediaConvert job: ${jobId} for ${key}`);
		} catch (error) {
			console.error(`Error creating job for ${key}:`, error);
			// Don't throw - continue processing other files
		}
	}

	callback(null, { statusCode: 200, body: "Processing complete" });
};

/**
 * Create MediaConvert job
 */
async function createMediaConvertJob(
	client: MediaConvertClient,
	bucket: string,
	key: string,
	uuid: string,
): Promise<string> {
	const inputPath = `s3://${bucket}/${key}`;
	const outputPath = `s3://${OUTPUT_BUCKET}/${OUTPUT_PREFIX}/${uuid}`;

	const jobInput: CreateJobCommandInput = {
		Role: AWS_MEDIACONVERT_ROLE,
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
				// MP4 outputs
				{
					Name: "MP4 Group",
					OutputGroupSettings: {
						Type: "FILE_GROUP_SETTINGS",
						FileGroupSettings: {
							Destination: `${outputPath}/mp4/`,
						},
					},
					Outputs: Object.entries(OUTPUT_PRESETS).map(([quality, preset]) => ({
						NameModifier: `_${quality}`,
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
										QvbrQualityLevel: quality === "1080p" ? 8 : quality === "720p" ? 7 : 6,
									},
									MaxBitrate: preset.bitrate,
									SceneChangeDetect: "TRANSITION_DETECTION",
								},
							},
							Width: preset.width,
							Height: preset.height,
							ScalingBehavior: "DEFAULT",
							AntiAlias: "ENABLED",
						},
						AudioDescriptions: [
							{
								CodecSettings: {
									Codec: "AAC",
									AacSettings: {
										Bitrate: quality === "480p" ? 96000 : 128000,
										CodingMode: "CODING_MODE_2_0",
										SampleRate: 48000,
									},
								},
							},
						],
					})),
				},
				// HLS output for adaptive streaming
				{
					Name: "HLS Group",
					OutputGroupSettings: {
						Type: "HLS_GROUP_SETTINGS",
						HlsGroupSettings: {
							Destination: `${outputPath}/hls/`,
							SegmentLength: 6,
							MinSegmentLength: 0,
							SegmentControl: "SEGMENTED_FILES",
							ManifestCompression: "NONE",
							DirectoryStructure: "SINGLE_DIRECTORY",
						},
					},
					Outputs: Object.entries(OUTPUT_PRESETS).map(([quality, preset]) => ({
						NameModifier: `_${quality}`,
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
										QvbrQualityLevel: quality === "1080p" ? 8 : quality === "720p" ? 7 : 6,
									},
									MaxBitrate: preset.bitrate,
								},
							},
							Width: preset.width,
							Height: preset.height,
						},
						AudioDescriptions: [
							{
								CodecSettings: {
									Codec: "AAC",
									AacSettings: {
										Bitrate: quality === "480p" ? 96000 : 128000,
										CodingMode: "CODING_MODE_2_0",
										SampleRate: 48000,
									},
								},
							},
						],
					})),
				},
			],
		},
		Tags: {
			Project: "platz",
			MediaFileUuid: uuid,
			OriginalKey: key,
		},
	};

	const command = new CreateJobCommand(jobInput);
	const response = await client.send(command);

	if (!response.Job?.Id) {
		throw new Error("Failed to create MediaConvert job - no job ID returned");
	}

	return response.Job.Id;
}
