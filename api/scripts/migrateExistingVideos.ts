/**
 * Migration script to process existing videos with MediaConvert
 *
 * Usage:
 *   npx ts-node scripts/migrateExistingVideos.ts [--dry-run] [--limit=N]
 *
 * Options:
 *   --dry-run   Preview which videos would be processed without actually processing
 *   --limit=N   Process only first N videos
 */

import { PrismaClient } from "@prisma/client";
import { MediaConvertClient, CreateJobCommand, CreateJobCommandInput } from "@aws-sdk/client-mediaconvert";

const prisma = new PrismaClient();

// Configuration
const AWS_MEDIACONVERT_ENDPOINT =
	process.env.AWS_MEDIACONVERT_ENDPOINT || "https://mediaconvert.eu-central-1.amazonaws.com";
const AWS_MEDIACONVERT_ROLE =
	process.env.AWS_MEDIACONVERT_ROLE || "arn:aws:iam::664267706628:role/platz-mediaconvert-role";
const S3_BUCKET = process.env.AWS_S3_BUCKET || "platz-dev";
const OUTPUT_PREFIX = "optimized";
const REGION = process.env.AWS_REGION || "eu-central-1";

// Minimum file size to process (1MB)
const MIN_FILE_SIZE = 1024 * 1024;

// Video output presets
const OUTPUT_PRESETS = {
	"1080p": { width: 1920, height: 1080, bitrate: 8000000 },
	"720p": { width: 1280, height: 720, bitrate: 5000000 },
	"480p": { width: 854, height: 480, bitrate: 2500000 },
};

async function createMediaConvertJob(client: MediaConvertClient, uuid: string, _filename: string): Promise<string> {
	// uuid already contains the full path like "uuid/filename.mp4"
	// Extract just the UUID part for output path
	const uuidOnly = uuid.split("/")[0];
	const inputPath = `s3://${S3_BUCKET}/${uuid}`;
	const outputPath = `s3://${S3_BUCKET}/${OUTPUT_PREFIX}/${uuidOnly}`;

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
				// HLS output
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
			MigrationScript: "true",
		},
	};

	const command = new CreateJobCommand(jobInput);
	const response = await client.send(command);

	if (!response.Job?.Id) {
		throw new Error("Failed to create MediaConvert job");
	}

	return response.Job.Id;
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const limitArg = args.find((a) => a.startsWith("--limit="));
	const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

	console.log("🎬 Video Migration Script");
	console.log("========================");
	console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
	if (limit) console.log(`Limit: ${limit} videos`);
	console.log("");

	// Find all video files that haven't been processed yet
	const videos = await prisma.mediaFile.findMany({
		where: {
			mimeType: {
				startsWith: "video/",
			},
			size: {
				gte: MIN_FILE_SIZE,
			},
			// Not already processed or processing
			OR: [{ processingStatus: null }, { processingStatus: "failed" }],
			deletedAt: null,
		},
		orderBy: {
			createdAt: "desc",
		},
		take: limit,
	});

	console.log(`Found ${videos.length} videos to process\n`);

	if (videos.length === 0) {
		console.log("No videos to process. Exiting.");
		return;
	}

	if (dryRun) {
		console.log("Videos that would be processed:");
		for (const video of videos) {
			const sizeMB = Number(video.size) / 1024 / 1024;
			console.log(`  - ${video.originalName} (${sizeMB.toFixed(2)} MB) [${video.uuid}]`);
		}
		console.log("\nRun without --dry-run to process these videos.");
		return;
	}

	const mediaConvert = new MediaConvertClient({
		region: REGION,
		endpoint: AWS_MEDIACONVERT_ENDPOINT,
	});

	let processed = 0;
	let failed = 0;

	for (const video of videos) {
		const sizeMB = Number(video.size) / 1024 / 1024;
		console.log(`Processing: ${video.originalName} (${sizeMB.toFixed(2)} MB)`);

		try {
			const jobId = await createMediaConvertJob(mediaConvert, video.uuid, video.filename);

			// Update database
			await prisma.mediaFile.update({
				where: { id: video.id },
				data: {
					processingStatus: "processing",
					processingJobId: jobId,
					processingStartedAt: new Date(),
					processingError: null,
				},
			});

			console.log(`  ✅ Job created: ${jobId}`);
			processed++;

			// Small delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 500));
		} catch (error) {
			console.error(`  ❌ Failed: ${error}`);
			failed++;

			await prisma.mediaFile.update({
				where: { id: video.id },
				data: {
					processingStatus: "failed",
					processingError: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	console.log("\n========================");
	console.log(`✅ Processed: ${processed}`);
	console.log(`❌ Failed: ${failed}`);
	console.log(`📊 Total: ${videos.length}`);
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
