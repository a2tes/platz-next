import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { UploadResult, StorageProvider, MediaUrlSet } from "../interfaces/StorageProvider";
import { imageService } from "./image";

const S3_CONFIG = {
	bucket: process.env.AWS_S3_BUCKET || "",
	region: process.env.AWS_REGION || "eu-central-1",
	accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
	endpoint: process.env.AWS_ENDPOINT,
	url: process.env.AWS_URL,
};

export class S3Service implements StorageProvider {
	private s3Client: S3Client;

	constructor() {
		this.s3Client = new S3Client({
			region: S3_CONFIG.region,
			credentials: {
				accessKeyId: S3_CONFIG.accessKeyId,
				secretAccessKey: S3_CONFIG.secretAccessKey,
			},
			...(S3_CONFIG.endpoint && { endpoint: S3_CONFIG.endpoint }),
		});
	}

	async uploadFile(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<UploadResult> {
		const fileUuid = uuidv4();
		// Clean filename
		const ext = path.extname(originalName);
		const name = originalName.split(/[\/\\]/).pop() || "file";
		const normalizedName = name.toLowerCase().replace(/[^a-z0-9.]/g, "-");

		// S3 Key format: uuid/filename.jpg
		const key = `${fileUuid}/${normalizedName}`;

		const command = new PutObjectCommand({
			Bucket: S3_CONFIG.bucket,
			Key: key,
			Body: buffer,
			ContentType: mimeType,
			// BU SATIRI SİLİN veya YORUMA ALIN:
			// ACL: "public-read",
			// Çünkü bucket'ımız private, erişimi CloudFront yönetecek.
		});

		await this.s3Client.send(command);

		// Construct public URL
		let publicUrl = "";
		if (S3_CONFIG.url) {
			publicUrl = `${S3_CONFIG.url}/${key}`;
		} else {
			publicUrl = `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
		}

		return {
			filename: normalizedName,
			originalName,
			mimeType,
			size: buffer.length,
			uuid: key, // S3 Key as UUID
			publicUrl,
		};
	}

	async deleteFile(uuid: string): Promise<void> {
		const command = new DeleteObjectCommand({
			Bucket: S3_CONFIG.bucket,
			Key: uuid,
		});
		await this.s3Client.send(command);
	}

	generateUrlSet(uuid: string, mimeType?: string, thumbnailTime?: number | null): MediaUrlSet {
		// Use configured image service (imgix, imagekit, etc.)
		if (mimeType) {
			return imageService.generateUrlSet(uuid, mimeType, thumbnailTime);
		}

		// Fallback to direct URLs (no image provider configured or no mimeType)
		const baseUrl = S3_CONFIG.url
			? `${S3_CONFIG.url}/${uuid}`
			: `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${uuid}`;

		return {
			images: {
				original: baseUrl,
				thumbnail: baseUrl,
				small: baseUrl,
				medium: baseUrl,
				large: baseUrl,
			},
		};
	}

	async getFileBuffer(uuid: string): Promise<Buffer | null> {
		try {
			const command = new GetObjectCommand({
				Bucket: S3_CONFIG.bucket,
				Key: uuid,
			});
			const response = await this.s3Client.send(command);

			if (response.Body) {
				const chunks: Uint8Array[] = [];
				for await (const chunk of response.Body as any) {
					chunks.push(chunk);
				}
				return Buffer.concat(chunks);
			}
			return null;
		} catch (e) {
			console.error("S3 Get Error:", e);
			return null;
		}
	}

	/**
	 * Upload a thumbnail image for a video file
	 * @param buffer Image buffer (JPEG)
	 * @param videoUuid UUID of the video file (format: uuid/filename.mp4)
	 * @param timestamp Timestamp used in filename for cache busting
	 * @returns The S3 key path for the thumbnail
	 */
	async uploadVideoThumbnail(buffer: Buffer, videoUuid: string, timestamp: number): Promise<string> {
		// Extract the UUID part (before the slash)
		const uuidPart = videoUuid.split("/")[0];

		// Thumbnail path format: {uuid}/thumbnail-{timestamp}.jpg
		const thumbnailKey = `${uuidPart}/thumbnail-${timestamp}.jpg`;

		const command = new PutObjectCommand({
			Bucket: S3_CONFIG.bucket,
			Key: thumbnailKey,
			Body: buffer,
			ContentType: "image/jpeg",
			CacheControl: "public, max-age=31536000", // 1 year cache (filename has timestamp)
		});

		await this.s3Client.send(command);

		return thumbnailKey;
	}

	/**
	 * Generate a presigned URL for direct client-to-S3 upload
	 * @param originalName Original filename
	 * @param mimeType MIME type of the file
	 * @param expiresIn URL expiration time in seconds (default: 10 minutes)
	 * @returns Object with presigned URL and S3 key
	 */
	async generatePresignedUploadUrl(
		originalName: string,
		mimeType: string,
		expiresIn: number = 600
	): Promise<{ presignedUrl: string; key: string; uuid: string }> {
		const fileUuid = uuidv4();
		// Clean filename
		const ext = path.extname(originalName);
		const name = originalName.split(/[\/\\]/).pop() || "file";
		const normalizedName = name.toLowerCase().replace(/[^a-z0-9.]/g, "-");

		// S3 Key format: uuid/filename.jpg
		const key = `${fileUuid}/${normalizedName}`;

		const command = new PutObjectCommand({
			Bucket: S3_CONFIG.bucket,
			Key: key,
			ContentType: mimeType,
		});

		const presignedUrl = await getSignedUrl(this.s3Client, command, {
			expiresIn,
		});

		return {
			presignedUrl,
			key,
			uuid: fileUuid,
		};
	}

	/**
	 * Get the public URL for a given S3 key
	 */
	getPublicUrl(key: string): string {
		if (S3_CONFIG.url) {
			return `${S3_CONFIG.url}/${key}`;
		}
		return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
	}
}

export const s3Service = new S3Service();
