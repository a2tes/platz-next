/**
 * Backfill video metadata for media files that are COMPLETED but missing metadata
 * Uses ffprobe to extract video dimensions
 */

import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { VIDEO_PROCESSING_CONFIG } from "../src/config/videoProcessing";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface VideoInfo {
	width: number;
	height: number;
	duration?: number;
}

async function getVideoInfo(url: string): Promise<VideoInfo | null> {
	try {
		// Use ffprobe to get video info
		const command = `ffprobe -v quiet -print_format json -show_streams "${url}"`;
		const { stdout } = await execAsync(command, { timeout: 30000 });
		const data = JSON.parse(stdout);

		const videoStream = data.streams?.find((s: any) => s.codec_type === "video");
		if (!videoStream) {
			console.log(`  No video stream found`);
			return null;
		}

		return {
			width: videoStream.width,
			height: videoStream.height,
			duration: videoStream.duration ? parseFloat(videoStream.duration) : undefined,
		};
	} catch (error) {
		console.error(`  ffprobe error:`, error);
		return null;
	}
}

async function main() {
	console.log("Finding media files with COMPLETED status but no metadata...\n");

	const mediaFiles = await prisma.mediaFile.findMany({
		where: {
			processingStatus: "COMPLETED",
			mimeType: { startsWith: "video/" },
			OR: [{ metadata: { equals: null } }, { metadata: { path: ["width"], equals: null } }],
		},
		select: {
			id: true,
			uuid: true,
			originalPath: true,
			optimizedUrls: true,
			metadata: true,
		},
	});

	console.log(`Found ${mediaFiles.length} media files to process\n`);

	const { s3 } = VIDEO_PROCESSING_CONFIG;
	let updated = 0;
	let failed = 0;

	for (const file of mediaFiles) {
		console.log(`Processing media file ${file.id} (${file.uuid})...`);

		// Try to get video URL (prefer 720p, fallback to original)
		const optimizedUrls = file.optimizedUrls as Record<string, string> | null;
		let videoUrl: string;

		if (optimizedUrls?.["720p"]) {
			videoUrl = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${optimizedUrls["720p"]}`;
		} else if (optimizedUrls?.["1080p"]) {
			videoUrl = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${optimizedUrls["1080p"]}`;
		} else if (file.originalPath) {
			videoUrl = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${file.originalPath}`;
		} else {
			console.log(`  Skipping: No video URL available`);
			failed++;
			continue;
		}

		console.log(`  Fetching info from: ${videoUrl}`);
		const info = await getVideoInfo(videoUrl);

		if (info) {
			await prisma.mediaFile.update({
				where: { id: file.id },
				data: {
					metadata: {
						width: info.width,
						height: info.height,
						...(info.duration && { duration: info.duration }),
					},
				},
			});
			console.log(`  ✓ Updated: ${info.width}x${info.height}${info.duration ? `, ${info.duration}s` : ""}`);
			updated++;
		} else {
			console.log(`  ✗ Failed to get video info`);
			failed++;
		}
	}

	console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
