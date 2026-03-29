import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { UploadResult, StorageProvider, MediaUrlSet } from "../interfaces/StorageProvider";

export class LocalStorageService implements StorageProvider {
	private uploadDir: string;
	private publicUrl: string;

	constructor() {
		if (!process.env.MEDIA_LIBRARY_LOCAL_PATH) {
			throw new Error("MEDIA_LIBRARY_LOCAL_PATH environment variable is not set.");
		}
		this.uploadDir = path.resolve(process.cwd(), process.env.MEDIA_LIBRARY_LOCAL_PATH);
		this.publicUrl = `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}/storage`;

		this.ensureUploadDir();
	}

	private ensureUploadDir(): void {
		if (!fs.existsSync(this.uploadDir)) {
			fs.mkdirSync(this.uploadDir, { recursive: true });
		}

		// Create subdirectories for local storage
		const subdirs = ["images", "videos", "documents", "other"];
		subdirs.forEach((subdir) => {
			const subdirPath = path.join(this.uploadDir, subdir);
			if (!fs.existsSync(subdirPath)) {
				fs.mkdirSync(subdirPath, { recursive: true });
			}
		});
	}

	/**
	 * Get file category based on mime type
	 */
	private getFileCategory(mimeType: string): string {
		if (mimeType.startsWith("image/")) return "images";
		if (mimeType.startsWith("video/")) return "videos";
		if (mimeType.includes("pdf") || mimeType.includes("document")) return "documents";
		return "other";
	}

	/**
	 * Generate normalized filename from original name
	 */
	private normalizeFilename(originalName: string): string {
		// Remove path separators and convert to lowercase
		const name = originalName.split(/[\/\\]/).pop() || "file";
		// Replace spaces and special chars with hyphens, keep only alphanumeric, hyphens, and dots
		return name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w.-]/g, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
	}

	/**
	 * Upload file to local storage
	 */
	async uploadFile(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadResult> {
		// Generate UUID for the file
		const fileUuid = uuidv4();
		const normalizedName = this.normalizeFilename(originalName);
		const ext = path.extname(originalName);
		const filenameWithExt = normalizedName || `file${ext}`;

		// UUID format: 87083e35-ed09-4199-a209-229b6cee9390/filename.jpg
		const uuid = `${fileUuid}/${filenameWithExt}`;

		// Local storage: save to disk
		const category = this.getFileCategory(mimeType);
		const fullPath = path.join(this.uploadDir, category, uuid);

		// Ensure directory exists
		const dir = path.dirname(fullPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Write file to disk
		await fs.promises.writeFile(fullPath, buffer);

		return {
			filename: filenameWithExt,
			originalName,
			mimeType,
			size: buffer.length,
			uuid,
			publicUrl: `${this.publicUrl}/${category}/${uuid}`,
		};
	}

	/**
	 * Delete file from local storage
	 */
	async deleteFile(uuid: string): Promise<void> {
		// Try to find the file in all categories
		const categories = ["images", "videos", "documents", "other"];

		for (const category of categories) {
			const fullPath = path.join(this.uploadDir, category, uuid);
			if (fs.existsSync(fullPath)) {
				try {
					await fs.promises.unlink(fullPath);
					// Also try to remove the parent directory (the uuid folder) if empty
					const dir = path.dirname(fullPath);
					const files = await fs.promises.readdir(dir);
					if (files.length === 0) {
						await fs.promises.rmdir(dir);
					}
					return;
				} catch (error) {
					console.warn(`Failed to delete file: ${fullPath}`, error);
				}
			}
		}
	}

	/**
	 * Generate URL set for files
	 */
	generateUrlSet(uuid: string, mimeType?: string, thumbnailTime?: number | null): MediaUrlSet {
		const category = mimeType ? this.getFileCategory(mimeType) : "images";
		const baseUrl = `${this.publicUrl}/${category}/${uuid}`;

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
		const categories = ["images", "videos", "documents", "other"];

		for (const category of categories) {
			const fullPath = path.join(this.uploadDir, category, uuid);
			if (fs.existsSync(fullPath)) {
				return await fs.promises.readFile(fullPath);
			}
		}
		return null;
	}
}

export const localStorageService = new LocalStorageService();
