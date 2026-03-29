import { storageService } from "./storageService";
import { videoProcessingService } from "./videoProcessingService";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";
import { FileValidator } from "../utils/fileValidation";
import { humanizeFilename } from "../utils/humanizeFilename";
import { PrismaClient } from "@prisma/client";
import { ImageUrlSet, VideoUrlSet, MediaUrlSet } from "../interfaces/StorageProvider";

const prisma = new PrismaClient();

export interface MediaUploadResult {
	id: number;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	uuid: string;
	images: ImageUrlSet;
	video?: VideoUrlSet;
	category: "image" | "video" | "document" | "other";
	folderId?: number;
	createdAt: Date;
}

export interface MediaFileInfo {
	id: number;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	uuid: string;
	images: ImageUrlSet;
	video?: VideoUrlSet;
	category: "image" | "video" | "document" | "other";
	folderId?: number;
	altText?: string;
	thumbnailTime?: number;
	thumbnailPath?: string;
	processingStatus?: string;
	usageCount: number;
	hasClips?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface FolderInfo {
	id: number;
	name: string;
	parentId?: number;
	path: string;
	fileCount: number;
	subfolderCount: number;
	totalFileCount: number; // Total files in this folder and all subfolders
	createdAt: Date;
	updatedAt: Date;
}

// Default empty URL set for files without uuid
const emptyUrlSet: MediaUrlSet = {
	images: {
		original: "",
		thumbnail: "",
		small: "",
		medium: "",
		large: "",
	},
	video: undefined,
};

/**
 * Helper to convert path to CloudFront URL
 */
function toCloudFrontUrl(path: string | null | undefined): string {
	if (!path) return "";
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const domain = VIDEO_PROCESSING_CONFIG.cloudfront.domain;
	// Remove leading slash if present to avoid double slashes
	const cleanPath = path.startsWith("/") ? path.substring(1) : path;
	return domain ? `https://${domain}/${cleanPath}` : path;
}

export class MediaService {
	/**
	 * Get or create Uncategorized folder
	 */
	private async getUncategorizedFolder(): Promise<number> {
		// Check if Uncategorized folder exists
		let uncategorizedFolder = await prisma.mediaFolder.findFirst({
			where: {
				name: "Uncategorized",
				parentId: null,
				deletedAt: null,
				purgedAt: null,
			} as any,
		});

		// Create if doesn't exist
		if (!uncategorizedFolder) {
			uncategorizedFolder = await prisma.mediaFolder.create({
				data: {
					name: "Uncategorized",
					parentId: null,
					path: "/Uncategorized",
				},
			});
		}

		return uncategorizedFolder.id;
	}

	/**
	 * Get all subfolder IDs recursively
	 */
	private async getSubfolderIds(folderId?: number): Promise<number[]> {
		if (!folderId) {
			// If no folder specified, get all folders
			const allFolders = await prisma.mediaFolder.findMany({
				where: { deletedAt: null, purgedAt: null } as any,
				select: { id: true },
			});
			return allFolders.map((f) => f.id);
		}

		const subfolders = await prisma.mediaFolder.findMany({
			where: {
				OR: [
					{ id: folderId }, // Include the folder itself
					{ parentId: folderId }, // Include direct children
				],
				deletedAt: null,
				purgedAt: null,
			} as any,
			select: { id: true, parentId: true },
		});

		// Get all nested subfolders recursively
		const allSubfolderIds = [folderId];
		const directChildren = subfolders.filter((f) => f.parentId === folderId);

		for (const child of directChildren) {
			const nestedIds = await this.getSubfolderIds(child.id);
			allSubfolderIds.push(...nestedIds);
		}

		return [...new Set(allSubfolderIds)]; // Remove duplicates
	}
	/**
	 * Upload a single file to S3 and create database record
	 */
	async uploadFile(
		file: Buffer,
		originalName: string,
		mimeType: string,
		folderId?: number,
	): Promise<MediaUploadResult> {
		try {
			// If no folderId provided, use Uncategorized folder
			if (!folderId) {
				folderId = await this.getUncategorizedFolder();
			}

			// Validate file
			const validation = FileValidator.validateFile({
				originalName,
				mimeType,
				size: file.length,
				buffer: file,
			});

			if (!validation.isValid) {
				throw new Error(validation.error);
			}

			// Upload to local storage
			const uploadResult = await storageService.uploadFile(file, originalName, mimeType);

			// Generate URLs
			const urlSet = storageService.generateUrlSet(uploadResult.uuid, mimeType); // Humanize original_name for display
			const humanizedName = humanizeFilename(originalName);

			// Create database record
			const mediaFile = await prisma.mediaFile.create({
				data: {
					filename: uploadResult.filename,
					originalName: humanizedName,
					mimeType,
					size: BigInt(uploadResult.size),
					uuid: uploadResult.uuid,
					folderId,
					thumbnailTime: mimeType.startsWith("video/") ? 1 : undefined,
					// Set initial processing status for videos
					processingStatus: mimeType.startsWith("video/") ? "pending" : undefined,
				} as any,
			});

			// Start video processing for video files (async, don't wait)
			if (mimeType.startsWith("video/")) {
				videoProcessingService
					.startProcessing(mediaFile.id)
					.then((jobId) => {
						// If no job was created (not processable), clear the pending status
						if (!jobId) {
							prisma.mediaFile
								.update({
									where: { id: mediaFile.id },
									data: { processingStatus: null },
								})
								.catch(() => {});
						}
					})
					.catch((error) => {
						console.error(`[MediaService] Failed to start video processing for file ${mediaFile.id}:`, error);
					});
			}

			return {
				id: mediaFile.id,
				filename: mediaFile.filename,
				originalName: mediaFile.originalName,
				mimeType: mediaFile.mimeType,
				size: Number(mediaFile.size),
				uuid: mediaFile.uuid,
				images: urlSet.images,
				video: urlSet.video,
				category: FileValidator.getFileCategory(mimeType),
				folderId: mediaFile.folderId || undefined,
				createdAt: mediaFile.createdAt,
			};
		} catch (error) {
			console.error("Error uploading file:", error);
			throw error;
		}
	}

	/**
	 * Upload multiple files
	 */
	async uploadFiles(
		files: Array<{ buffer: Buffer; originalName: string; mimeType: string }>,
		folderId?: number,
	): Promise<MediaUploadResult[]> {
		const results: MediaUploadResult[] = [];
		const errors: string[] = [];

		for (let i = 0; i < files.length; i++) {
			try {
				const result = await this.uploadFile(files[i].buffer, files[i].originalName, files[i].mimeType, folderId);
				results.push(result);
			} catch (error) {
				const errorMessage = `File ${i + 1} (${files[i].originalName}): ${
					error instanceof Error ? error.message : "Upload failed"
				}`;
				errors.push(errorMessage);
			}
		}

		if (errors.length > 0 && results.length === 0) {
			throw new Error(`All uploads failed: ${errors.join(", ")}`);
		}

		if (errors.length > 0) {
			console.warn("Some uploads failed:", errors);
		}

		return results;
	}

	/**
	 * Get file information by ID
	 */
	async getFileById(id: number): Promise<MediaFileInfo | null> {
		try {
			const mediaFile = await prisma.mediaFile.findUnique({
				where: { id },
				include: {
					_count: {
						select: {
							// Count usage across different content types
							worksVideoFile: true,
							worksPreviewImage: true,
							directorsAvatar: true,
							starringsAvatar: true,
							photographyImage: true,
							photographyPreviewImage: true,
							photographersAvatar: true,
							contentPagesPreviewImage: true,
						},
					},
				} as any,
			});

			if (!mediaFile) return null;

			// Calculate total usage count
			const usageCount = Object.values((mediaFile as any)._count || {}).reduce(
				(sum: number, count: any) => sum + Number(count || 0),
				0,
			);

			// Generate current URLs with thumbnailTime for video posters
			const thumbnailTime = (mediaFile as any).thumbnailTime;
			const thumbnailPath = (mediaFile as any).thumbnailPath as string | null;
			const processingStatus = (mediaFile as any).processingStatus as string | null;
			const hlsUrl = (mediaFile as any).hlsUrl as string | null;
			const optimizedVideoUrl = (mediaFile as any).optimizedVideoUrl as string | null;
			const optimizedUrls = (mediaFile as any).optimizedUrls as Record<string, string> | null;

			let images: MediaFileInfo["images"];
			let video: MediaFileInfo["video"];

			if (mediaFile.mimeType.startsWith("video/")) {
				// For videos, use thumbnailPath if available (served via ImageKit)
				if (thumbnailPath) {
					const thumbnailUrlSet = storageService.generateUrlSet(thumbnailPath, "image/jpeg");
					images = thumbnailUrlSet.images;
				} else {
					images = { original: "", thumbnail: "", small: "", medium: "", large: "" };
				}

				// Generate video URLs
				const videoUrlSet = mediaFile.uuid
					? storageService.generateUrlSet(mediaFile.uuid, mediaFile.mimeType)
					: emptyUrlSet;

				// Use optimized video URLs if processing is complete
				if (processingStatus === "completed" && (hlsUrl || optimizedVideoUrl)) {
					const optimizedMp4 = optimizedVideoUrl || optimizedUrls?.mp4_1080p || optimizedUrls?.mp4_720p || "";
					video = {
						default: toCloudFrontUrl(hlsUrl || optimizedMp4) || videoUrlSet.video?.default || "",
						provider: videoUrlSet.video?.provider || "",
						original: videoUrlSet.video?.original || "",
						hls: toCloudFrontUrl(hlsUrl),
						mp4: toCloudFrontUrl(optimizedMp4),
					};
				} else {
					video = videoUrlSet.video;
				}
			} else {
				// For non-video files, use standard URL generation
				const urlSet = mediaFile.uuid
					? storageService.generateUrlSet(mediaFile.uuid, mediaFile.mimeType, thumbnailTime)
					: emptyUrlSet;
				images = urlSet.images;
				video = urlSet.video;
			}

			return {
				id: mediaFile.id,
				filename: mediaFile.filename,
				originalName: mediaFile.originalName,
				mimeType: mediaFile.mimeType,
				size: Number(mediaFile.size),
				uuid: mediaFile.uuid,
				images,
				video,
				thumbnailTime: thumbnailTime || undefined,
				processingStatus: processingStatus || undefined,
				category: FileValidator.getFileCategory(mediaFile.mimeType),
				folderId: mediaFile.folderId || undefined,
				usageCount,
				createdAt: mediaFile.createdAt,
				updatedAt: mediaFile.updatedAt,
			};
		} catch (error) {
			console.error("Error getting file by ID:", error);
			throw new Error("Failed to retrieve file information");
		}
	}

	/**
	 * Update file metadata (altText, originalName, thumbnailTime, thumbnailPath)
	 */
	async updateFileMetadata(
		id: number,
		data: { altText?: string; originalName?: string; thumbnailTime?: number; thumbnailPath?: string },
	): Promise<MediaFileInfo> {
		try {
			const mediaFile = await prisma.mediaFile.update({
				where: { id },
				data: {
					...(data.altText !== undefined && { altText: data.altText }),
					...(data.originalName !== undefined && {
						originalName: data.originalName,
					}),
					...(data.thumbnailTime !== undefined && {
						thumbnailTime: data.thumbnailTime,
					}),
					...(data.thumbnailPath !== undefined && {
						thumbnailPath: data.thumbnailPath,
					}),
				},
			});

			// Return updated file with full info
			const updatedFile = await this.getFileById(id);
			if (!updatedFile) {
				throw new Error("File not found after update");
			}
			return updatedFile;
		} catch (error) {
			console.error("Error updating file metadata:", error);
			throw new Error("Failed to update file metadata");
		}
	}

	/**
	 * Delete a file from S3 and database
	 */
	async deleteFile(id: number): Promise<void> {
		try {
			const mediaFile = await prisma.mediaFile.findUnique({
				where: { id },
			});

			if (!mediaFile) {
				throw new Error("File not found");
			}

			// Check if file is being used
			const fileInfo = await this.getFileById(id);
			if (fileInfo && fileInfo.usageCount > 0) {
				throw new Error("Cannot delete file that is currently being used in content");
			}

			// Soft-delete: do not remove from storage, just mark as deleted
			await prisma.mediaFile.update({
				where: { id },
				data: { deletedAt: new Date() } as any,
			});
		} catch (error) {
			console.error("Error deleting file:", error);
			throw error;
		}
	}

	/**
	 * Delete multiple files
	 */
	async deleteFiles(ids: number[]): Promise<{
		deleted: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const deleted: number[] = [];
		const failed: Array<{ id: number; error: string }> = [];

		for (const id of ids) {
			try {
				await this.deleteFile(id);
				deleted.push(id);
			} catch (error) {
				failed.push({
					id,
					error: error instanceof Error ? error.message : "Delete failed",
				});
			}
		}

		return { deleted, failed };
	}

	/** Restore a file from Trash */
	async restoreFile(id: number): Promise<void> {
		await prisma.mediaFile.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	/** Purge a file (permanently delete from storage and database) */
	async purgeFile(id: number): Promise<void> {
		const mediaFile = await prisma.mediaFile.findUnique({
			where: { id },
		});

		if (!mediaFile) {
			throw new Error("File not found");
		}

		// Delete from storage (S3 or local)
		try {
			await storageService.deleteFile(mediaFile.uuid);
		} catch (error) {
			console.error(`Failed to delete file from storage: ${mediaFile.uuid}`, error);
			// Continue with database deletion even if storage deletion fails
		}

		// Permanently delete from database
		await prisma.mediaFile.delete({
			where: { id },
		});
	}

	/** Bulk restore files from Trash */
	async bulkRestoreFiles(ids: number[]): Promise<{
		restored: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const restored: number[] = [];
		const failed: Array<{ id: number; error: string }> = [];

		for (const id of ids) {
			try {
				await this.restoreFile(id);
				restored.push(id);
			} catch (error) {
				failed.push({
					id,
					error: error instanceof Error ? error.message : "Restore failed",
				});
			}
		}

		return { restored, failed };
	}

	/** Bulk purge files (permanently delete from storage and database) */
	async bulkPurgeFiles(ids: number[]): Promise<{
		purged: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const purged: number[] = [];
		const failed: Array<{ id: number; error: string }> = [];

		for (const id of ids) {
			try {
				await this.purgeFile(id);
				purged.push(id);
			} catch (error) {
				failed.push({
					id,
					error: error instanceof Error ? error.message : "Purge failed",
				});
			}
		}

		return { purged, failed };
	}

	/**
	 * Move file to different folder
	 */
	async moveFile(id: number, newFolderId?: number): Promise<MediaFileInfo> {
		try {
			const mediaFile = await prisma.mediaFile.findUnique({
				where: { id },
			});

			if (!mediaFile) {
				throw new Error("File not found");
			}

			// If no folder specified, use Uncategorized folder
			if (!newFolderId) {
				newFolderId = await this.getUncategorizedFolder();
			}

			// Validate target folder exists if specified
			if (newFolderId) {
				const folder = await prisma.mediaFolder.findUnique({
					where: { id: newFolderId },
				});
				if (!folder) {
					throw new Error("Target folder not found");
				}
			}

			// Files are stored by their UUID path
			// Only update the folder reference in the database
			// The file remains in its original storage location by UUID
			// but is now associated with a different logical folder

			// Update database record - only change folderId, keep uuid unchanged
			const updatedFile = await prisma.mediaFile.update({
				where: { id },
				data: {
					folderId: newFolderId,
				},
			});

			// Return updated file info
			const fileInfo = await this.getFileById(id);
			if (!fileInfo) {
				throw new Error("Failed to retrieve updated file information");
			}

			return fileInfo;
		} catch (error) {
			console.error("Error moving file:", error);
			throw error;
		}
	}

	/**
	 * Move multiple files to different folder
	 */
	async moveFiles(
		ids: number[],
		newFolderId?: number,
	): Promise<{
		moved: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const moved: number[] = [];
		const failed: Array<{ id: number; error: string }> = [];

		for (const id of ids) {
			try {
				await this.moveFile(id, newFolderId);
				moved.push(id);
			} catch (error) {
				failed.push({
					id,
					error: error instanceof Error ? error.message : "Move failed",
				});
			}
		}

		return { moved, failed };
	}

	/**
	 * Get files in a folder with pagination
	 */
	async getFilesInFolder(
		folderId?: number,
		page: number = 1,
		limit: number = 20,
		search?: string,
		type?: "image" | "video" | "file",
		mimeTypes?: string[],
	): Promise<{
		files: MediaFileInfo[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		try {
			const skip = (page - 1) * limit;

			// Get all subfolder IDs (including the current folder)
			const folderIds = await this.getSubfolderIds(folderId);

			const where: any = {
				folderId: {
					in: folderIds,
				},
				deletedAt: null,
				purgedAt: null,
			} as any;

			if (search) {
				where.OR = [{ originalName: { contains: search } }, { filename: { contains: search } }];
			}

			// Filter by type
			if (type) {
				if (type === "image") {
					where.mimeType = { startsWith: "image/" };
				} else if (type === "video") {
					where.mimeType = { startsWith: "video/" };
				} else if (type === "file") {
					where.AND = [
						{ NOT: { mimeType: { startsWith: "image/" } } },
						{ NOT: { mimeType: { startsWith: "video/" } } },
					];
				}
			}

			// Filter by specific mime types
			if (mimeTypes && mimeTypes.length > 0) {
				where.mimeType = { in: mimeTypes };
			}

			const [files, total] = await Promise.all([
				prisma.mediaFile.findMany({
					where,
					skip,
					take: limit,
					orderBy: { createdAt: "desc" },
					select: {
						id: true,
						filename: true,
						originalName: true,
						mimeType: true,
						size: true,
						uuid: true,
						folderId: true,
						altText: true,
						// @ts-ignore - these fields exist but aren't in Prisma types yet
						thumbnailTime: true,
						// @ts-ignore
						thumbnailPath: true,
						// @ts-ignore
						processingStatus: true,
						// @ts-ignore
						hlsUrl: true,
						// @ts-ignore
						optimizedVideoUrl: true,
						// @ts-ignore
						optimizedUrls: true,
						createdAt: true,
						updatedAt: true,
						_count: {
							select: {
								worksVideoFile: true,
								worksPreviewImage: true,
								directorsAvatar: true,
								starringsAvatar: true,
								photographyImage: true,
								photographyPreviewImage: true,
								photographersAvatar: true,
								contentPagesPreviewImage: true,
								clipJobs: true,
							} as any,
						} as any,
					},
				}),
				prisma.mediaFile.count({ where }),
			]);
			const fileInfos: MediaFileInfo[] = files.map((file) => {
				const counts = (file as any)._count as Record<string, number>;
				const clipJobCount = counts.clipJobs || 0;
				const usageCount = Object.entries(counts)
					.filter(([key]) => key !== "clipJobs")
					.reduce((sum, [, count]) => sum + count, 0);

				const thumbnailPath = (file as any).thumbnailPath as string | null;
				const processingStatus = (file as any).processingStatus as string | null;
				const hlsUrl = (file as any).hlsUrl as string | null;
				const optimizedVideoUrl = (file as any).optimizedVideoUrl as string | null;
				const optimizedUrls = (file as any).optimizedUrls as Record<string, string> | null;

				let images: MediaFileInfo["images"];
				let video: MediaFileInfo["video"];

				if (file.mimeType.startsWith("video/")) {
					// For videos, use thumbnailPath if available (served via ImageKit)
					if (thumbnailPath) {
						const thumbnailUrlSet = storageService.generateUrlSet(thumbnailPath, "image/jpeg");
						images = thumbnailUrlSet.images;
					} else {
						images = { original: "", thumbnail: "", small: "", medium: "", large: "" };
					}

					// Generate video URLs
					const videoUrlSet = file.uuid ? storageService.generateUrlSet(file.uuid, file.mimeType) : emptyUrlSet;

					// Use optimized video URLs if processing is complete
					if (processingStatus === "completed" && (hlsUrl || optimizedVideoUrl)) {
						const optimizedMp4 = optimizedVideoUrl || optimizedUrls?.mp4_1080p || optimizedUrls?.mp4_720p || "";
						video = {
							default: toCloudFrontUrl(hlsUrl || optimizedMp4) || videoUrlSet.video?.default || "",
							provider: videoUrlSet.video?.provider || "",
							original: videoUrlSet.video?.original || "",
							hls: toCloudFrontUrl(hlsUrl),
							mp4: toCloudFrontUrl(optimizedMp4),
						};
					} else {
						video = videoUrlSet.video;
					}
				} else {
					// For non-video files, use standard URL generation
					const urlSet = file.uuid ? storageService.generateUrlSet(file.uuid, file.mimeType) : emptyUrlSet;
					images = urlSet.images;
					video = urlSet.video;
				}

				return {
					id: file.id,
					filename: file.filename,
					originalName: file.originalName,
					mimeType: file.mimeType,
					size: Number(file.size),
					uuid: file.uuid,
					images,
					video,
					thumbnailTime: (file as any).thumbnailTime || undefined,
					processingStatus: processingStatus || undefined,
					category: FileValidator.getFileCategory(file.mimeType),
					folderId: file.folderId || undefined,
					usageCount,
					hasClips: clipJobCount > 0,
					createdAt: file.createdAt,
					updatedAt: file.updatedAt,
				};
			});

			return {
				files: fileInfos,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error) {
			console.error("Error getting files in folder:", error);
			throw new Error("Failed to retrieve files");
		}
	}

	/**
	 * Get files by type with pagination
	 */
	async getFilesByType(
		type: "image" | "video" | "document" | "all",
		folderId?: number,
		page: number = 1,
		limit: number = 20,
		search?: string,
	): Promise<{
		files: MediaFileInfo[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		try {
			// Get all subfolder IDs (including the current folder)
			const folderIds = await this.getSubfolderIds(folderId);

			const where: any = {
				folderId: {
					in: folderIds,
				},
				deletedAt: null,
				purgedAt: null,
			} as any;

			if (search) {
				where.OR = [{ originalName: { contains: search } }, { filename: { contains: search } }];
			}

			// Filter by type using mimeType
			if (type === "image") {
				where.mimeType = { startsWith: "image/" };
			} else if (type === "video") {
				where.mimeType = { startsWith: "video/" };
			} else if (type === "document") {
				where.AND = [{ NOT: { mimeType: { startsWith: "image/" } } }, { NOT: { mimeType: { startsWith: "video/" } } }];
			}
			// For 'all' type, no mimeType filtering

			// Fetch all matching files (no skip/take yet)
			const [allFiles, total] = await Promise.all([
				prisma.mediaFile.findMany({
					where,
					orderBy: { createdAt: "desc" },
					select: {
						id: true,
						filename: true,
						originalName: true,
						mimeType: true,
						size: true,
						uuid: true,
						folderId: true,
						altText: true,
						// @ts-ignore
						thumbnailTime: true,
						// @ts-ignore
						thumbnailPath: true,
						// Video processing fields
						// @ts-ignore
						processingStatus: true,
						// @ts-ignore
						hlsUrl: true,
						// @ts-ignore
						optimizedVideoUrl: true,
						// @ts-ignore
						optimizedUrls: true,
						createdAt: true,
						updatedAt: true,
						_count: {
							select: {
								worksVideoFile: true,
								worksPreviewImage: true,
								directorsAvatar: true,
								starringsAvatar: true,
								photographyImage: true,
								photographyPreviewImage: true,
								photographersAvatar: true,
								clipJobs: true,
							} as any,
						} as any,
					},
				}),
				prisma.mediaFile.count({ where }),
			]); // If viewing a specific folder, prioritize current folder files first
			if (folderId && allFiles.length > 0) {
				allFiles.sort((a, b) => {
					const aIsCurrent = a.folderId === folderId ? 0 : 1;
					const bIsCurrent = b.folderId === folderId ? 0 : 1;
					if (aIsCurrent !== bIsCurrent) {
						return aIsCurrent - bIsCurrent;
					}
					// Secondary sort by createdAt DESC within same priority
					return b.createdAt.getTime() - a.createdAt.getTime();
				});
			}

			// Apply pagination after sorting
			const skip = (page - 1) * limit;
			const files = allFiles.slice(skip, skip + limit);

			const fileInfos: MediaFileInfo[] = files.map((file) => {
				const counts = (file as any)._count as Record<string, number>;
				const clipJobCount = counts.clipJobs || 0;
				const usageCount = Object.entries(counts)
					.filter(([key]) => key !== "clipJobs")
					.reduce((sum, [, count]) => sum + count, 0);
				const thumbnailTime = (file as any).thumbnailTime;
				const thumbnailPath = (file as any).thumbnailPath;
				const processingStatus = (file as any).processingStatus;
				const hlsUrl = (file as any).hlsUrl;
				const optimizedVideoUrl = (file as any).optimizedVideoUrl;
				const optimizedUrls = (file as any).optimizedUrls;

				let urlSet = file.uuid ? storageService.generateUrlSet(file.uuid, file.mimeType, thumbnailTime) : emptyUrlSet;

				// For video files, handle images differently
				let images = urlSet.images;
				let video = urlSet.video;

				if (file.mimeType.startsWith("video/")) {
					if (thumbnailPath) {
						// Use custom uploaded thumbnail (served via ImageKit)
						const thumbnailUrlSet = storageService.generateUrlSet(thumbnailPath, "image/jpeg");
						images = thumbnailUrlSet.images;
					} else {
						// No custom thumbnail - return empty strings to trigger placeholder
						images = {
							original: "",
							thumbnail: "",
							small: "",
							medium: "",
							large: "",
						};
					}

					// Use optimized video URLs if processing is complete
					if (processingStatus === "completed" && (hlsUrl || optimizedVideoUrl)) {
						const optimizedMp4 = optimizedUrls?.["1080p"] || optimizedVideoUrl || null;
						video = {
							default: toCloudFrontUrl(hlsUrl || optimizedMp4) || video?.default || "",
							provider: video?.provider || "",
							hls: toCloudFrontUrl(hlsUrl) || null,
							mp4: toCloudFrontUrl(optimizedMp4) || null,
							original: video?.original || "",
						};
					}
				}

				return {
					id: file.id,
					filename: file.filename,
					originalName: file.originalName,
					mimeType: file.mimeType,
					size: Number(file.size),
					uuid: file.uuid,
					images,
					video,
					thumbnailTime: thumbnailTime || undefined,
					thumbnailPath: thumbnailPath || undefined,
					processingStatus: processingStatus || undefined,
					category: FileValidator.getFileCategory(file.mimeType),
					folderId: file.folderId || undefined,
					usageCount,
					hasClips: clipJobCount > 0,
					createdAt: file.createdAt,
					updatedAt: file.updatedAt,
				};
			});

			return {
				files: fileInfos,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error) {
			console.error("Error getting files by type:", error);
			throw new Error("Failed to retrieve files by type");
		}
	}

	/**
	 * Create a new folder
	 */
	async createFolder(name: string, parentId?: number): Promise<FolderInfo> {
		try {
			// Validate folder name
			const nameValidation = FileValidator.validateFileName(name);
			if (!nameValidation.isValid) {
				throw new Error(nameValidation.error);
			}

			// Get parent folder path
			let parentPath = "";
			if (parentId) {
				const parentFolder = await prisma.mediaFolder.findUnique({
					where: { id: parentId },
				});
				if (!parentFolder) {
					throw new Error("Parent folder not found");
				}
				parentPath = parentFolder.path;
			}

			// Generate folder path
			const folderPath = parentPath ? `${parentPath}/${name}` : name;

			// Check if folder already exists
			const existingFolder = await prisma.mediaFolder.findFirst({
				where: {
					name,
					parentId: parentId || null,
				},
			});

			if (existingFolder) {
				throw new Error("Folder with this name already exists in the parent directory");
			}

			// Create folder
			const folder = await prisma.mediaFolder.create({
				data: {
					name,
					parentId,
					path: folderPath,
				},
			});

			return {
				id: folder.id,
				name: folder.name,
				parentId: folder.parentId || undefined,
				path: folder.path,
				fileCount: 0,
				subfolderCount: 0,
				totalFileCount: 0,
				createdAt: folder.createdAt,
				updatedAt: folder.updatedAt,
			};
		} catch (error) {
			console.error("Error creating folder:", error);
			throw error;
		}
	}

	/**
	 * Get folder tree structure
	 */
	async getFolderTree(): Promise<FolderInfo[]> {
		try {
			const folders = await prisma.mediaFolder.findMany({
				where: { deletedAt: null, purgedAt: null } as any,
				orderBy: { path: "asc" },
			});

			// Calculate total file count for each folder (including all subfolders)
			const folderMap = new Map<
				number,
				{
					folder: (typeof folders)[0];
					totalFileCount: number;
					directFileCount: number;
					directChildCount: number;
				}
			>();

			// Initialize map with direct counts
			for (const folder of folders) {
				const [directFileCount, directChildCount] = await Promise.all([
					prisma.mediaFile.count({
						where: {
							folderId: folder.id,
							deletedAt: null,
							purgedAt: null,
						} as any,
					}),
					prisma.mediaFolder.count({
						where: {
							parentId: folder.id,
							deletedAt: null,
							purgedAt: null,
						} as any,
					}),
				]);
				folderMap.set(folder.id, {
					folder,
					totalFileCount: directFileCount,
					directFileCount,
					directChildCount,
				});
			}

			// Calculate total file counts by traversing the tree bottom-up
			const calculateTotalFiles = (folderId: number): number => {
				const entry = folderMap.get(folderId);
				if (!entry) return 0;
				// If already calculated beyond direct count, return cached
				if (entry.totalFileCount > entry.directFileCount) return entry.totalFileCount;

				// Get all child folders
				const children = folders.filter((f) => f.parentId === folderId);

				// Sum up files from all children recursively
				const childrenTotal = children.reduce((sum, child) => {
					return sum + calculateTotalFiles(child.id);
				}, 0);

				// Update total file count (direct active files + children's active files)
				entry.totalFileCount = entry.directFileCount + childrenTotal;
				return entry.totalFileCount;
			};

			// Calculate for all folders
			folders.forEach((folder) => calculateTotalFiles(folder.id));

			return folders.map((folder) => {
				const entry = folderMap.get(folder.id)!;
				return {
					id: folder.id,
					name: folder.name,
					parentId: folder.parentId || undefined,
					path: folder.path,
					fileCount: entry.directFileCount,
					subfolderCount: entry.directChildCount,
					totalFileCount: entry.totalFileCount,
					createdAt: folder.createdAt,
					updatedAt: folder.updatedAt,
				};
			});
		} catch (error) {
			console.error("Error getting folder tree:", error);
			throw new Error("Failed to retrieve folder structure");
		}
	}

	/**
	 * Delete a folder
	 */
	async deleteFolder(id: number): Promise<void> {
		try {
			const folder = await prisma.mediaFolder.findFirst({
				where: { id, deletedAt: null, purgedAt: null } as any,
			});

			if (!folder) {
				throw new Error("Folder not found");
			}

			// Prevent deletion of Uncategorized folder
			if (folder.name === "Uncategorized" && folder.parentId === null) {
				throw new Error("Cannot delete Uncategorized folder");
			}

			// Check if folder is empty (only active contents)
			const [activeFiles, activeChildren] = await Promise.all([
				prisma.mediaFile.count({
					where: { folderId: id, deletedAt: null, purgedAt: null } as any,
				}),
				prisma.mediaFolder.count({
					where: { parentId: id, deletedAt: null, purgedAt: null } as any,
				}),
			]);
			if (activeFiles > 0 || activeChildren > 0) {
				throw new Error("Cannot delete non-empty folder");
			}

			await prisma.mediaFolder.update({
				where: { id },
				data: { deletedAt: new Date() } as any,
			});
		} catch (error) {
			console.error("Error deleting folder:", error);
			throw error;
		}
	}

	/**
	 * Rename a folder
	 */
	async renameFolder(id: number, newName: string): Promise<FolderInfo> {
		try {
			// Validate folder name
			const nameValidation = FileValidator.validateFileName(newName);
			if (!nameValidation.isValid) {
				throw new Error(nameValidation.error);
			}

			const folder = await prisma.mediaFolder.findFirst({
				where: { id, deletedAt: null, purgedAt: null } as any,
			});

			if (!folder) {
				throw new Error("Folder not found");
			}

			// Prevent renaming of Uncategorized folder
			if (folder.name === "Uncategorized" && folder.parentId === null) {
				throw new Error("Cannot rename Uncategorized folder");
			}

			// Check if folder with new name already exists in same parent
			const existingFolder = await prisma.mediaFolder.findFirst({
				where: {
					name: newName,
					parentId: folder.parentId,
					id: { not: id },
					deletedAt: null,
					purgedAt: null,
				} as any,
			});

			if (existingFolder) {
				throw new Error("Folder with this name already exists in the parent directory");
			}

			// Update folder name and path
			const parentPath = folder.path.substring(0, folder.path.lastIndexOf("/"));
			const newPath = parentPath ? `${parentPath}/${newName}` : newName;

			const updatedFolder = await prisma.mediaFolder.update({
				where: { id },
				data: {
					name: newName,
					path: newPath,
				},
				include: {
					_count: {
						select: {
							files: true,
							children: true,
						},
					},
				},
			});

			// Update paths of all child folders
			await this.updateChildFolderPaths(id, newPath);

			// Calculate total file count
			const subfolderIds = await this.getSubfolderIds(id);
			const totalFiles = await prisma.mediaFile.count({
				where: {
					folderId: {
						in: subfolderIds,
					},
				},
			});

			return {
				id: updatedFolder.id,
				name: updatedFolder.name,
				parentId: updatedFolder.parentId || undefined,
				path: updatedFolder.path,
				fileCount: updatedFolder._count.files,
				subfolderCount: updatedFolder._count.children,
				totalFileCount: totalFiles,
				createdAt: updatedFolder.createdAt,
				updatedAt: updatedFolder.updatedAt,
			};
		} catch (error) {
			console.error("Error renaming folder:", error);
			throw error;
		}
	}

	/**
	 * Update paths of child folders recursively
	 */
	private async updateChildFolderPaths(parentId: number, newParentPath: string): Promise<void> {
		const childFolders = await prisma.mediaFolder.findMany({
			where: { parentId },
		});

		for (const child of childFolders) {
			const newChildPath = `${newParentPath}/${child.name}`;
			await prisma.mediaFolder.update({
				where: { id: child.id },
				data: { path: newChildPath },
			});

			// Recursively update grandchildren
			await this.updateChildFolderPaths(child.id, newChildPath);
		}
	}

	/**
	 * Get file usage details
	 */
	async getFileUsage(fileId: number): Promise<any> {
		const file = await prisma.mediaFile.findUnique({
			where: { id: fileId },
			include: {
				worksVideoFile: { select: { id: true, title: true } },
				worksPreviewImage: { select: { id: true, title: true } },
				directorsAvatar: { select: { id: true, title: true } },
				starringsAvatar: { select: { id: true, title: true } },
				photographyImage: { select: { id: true, title: true } },
				photographyPreviewImage: { select: { id: true, title: true } },
				photographersAvatar: { select: { id: true, title: true } },
				photographersCoverImage: { select: { id: true, title: true } },
				photographersPreviewImage: { select: { id: true, title: true } },
				contentPagesPreviewImage: { select: { id: true, title: true } },
				mediables: {
					select: {
						subjectType: true,
						subjectId: true,
						usageKey: true,
					},
				},
			} as any,
		});

		if (!file) {
			throw new Error("File not found");
		}

		return {
			works: [
				...file.worksVideoFile.map((w: any) => ({ ...w, usage: "Video" })),
				...file.worksPreviewImage.map((w: any) => ({ ...w, usage: "Preview Image" })),
			],
			directors: file.directorsAvatar.map((d: any) => ({ ...d, usage: "Avatar" })),
			starrings: file.starringsAvatar.map((s: any) => ({ ...s, usage: "Avatar" })),
			photography: [
				...file.photographyImage.map((p: any) => ({ ...p, usage: "Image" })),
				...file.photographyPreviewImage.map((p: any) => ({ ...p, usage: "Preview Image" })),
			],
			photographers: [
				...file.photographersAvatar.map((p: any) => ({ ...p, usage: "Avatar" })),
				...file.photographersCoverImage.map((p: any) => ({ ...p, usage: "Cover Image" })),
				...file.photographersPreviewImage.map((p: any) => ({ ...p, usage: "Preview Image" })),
			],
			contentPages: file.contentPagesPreviewImage.map((c: any) => ({ ...c, usage: "Preview Image" })),
			// other: file.mediables.map((m: any) => ({
			// 	subjectType: m.subjectType,
			// 	subjectId: m.subjectId,
			// 	usage: m.usageKey,
			// })),
		};
	}

	/**
	 * Get media statistics
	 */
	async getMediaStats(): Promise<{
		totalFiles: number;
		totalSize: number;
		filesByType: Record<string, number>;
		recentUploads: number;
	}> {
		try {
			const activeWhere: any = { deletedAt: null, purgedAt: null } as any;
			const [totalFiles, files, recentFiles] = await Promise.all([
				prisma.mediaFile.count({ where: activeWhere }),
				prisma.mediaFile.findMany({
					select: {
						size: true,
						mimeType: true,
					},
					where: activeWhere,
				}),
				prisma.mediaFile.count({
					where: {
						createdAt: {
							gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
						},
						deletedAt: null,
						purgedAt: null,
					} as any,
				}),
			]);

			const totalSize = files.reduce((sum, file) => sum + Number(file.size), 0);

			const filesByType = files.reduce(
				(acc, file) => {
					const category = FileValidator.getFileCategory(file.mimeType);
					acc[category] = (acc[category] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			return {
				totalFiles,
				totalSize,
				filesByType,
				recentUploads: recentFiles,
			};
		} catch (error) {
			console.error("Error getting media stats:", error);
			throw new Error("Failed to retrieve media statistics");
		}
	}

	/**
	 * Search media files
	 */
	async searchMedia(
		query: string,
		type?: "image" | "video" | "document",
		page: number = 1,
		limit: number = 20,
	): Promise<{
		files: MediaFileInfo[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		try {
			const skip = (page - 1) * limit;

			const where: any = {
				OR: [
					{ originalName: { contains: query, mode: "insensitive" } },
					{ filename: { contains: query, mode: "insensitive" } },
				],
				deletedAt: null,
				purgedAt: null,
			} as any;

			if (type) {
				const mimeTypePrefix = type === "image" ? "image/" : type === "video" ? "video/" : "application/";
				where.mimeType = { startsWith: mimeTypePrefix };
			}

			const [files, total] = await Promise.all([
				prisma.mediaFile.findMany({
					where,
					skip,
					take: limit,
					orderBy: { createdAt: "desc" },
					include: {
						_count: {
							select: {
								worksVideoFile: true,
								worksPreviewImage: true,
								directorsAvatar: true,
								starringsAvatar: true,
								photographyImage: true,
								photographyPreviewImage: true,
								photographersAvatar: true,
								contentPagesPreviewImage: true,
							},
						},
					} as any,
				}),
				prisma.mediaFile.count({ where }),
			]);

			const fileInfos: MediaFileInfo[] = files.map((file) => {
				const usageCount = Object.values((file as any)._count || {}).reduce(
					(sum: number, count: any) => sum + Number(count || 0),
					0,
				);
				const thumbnailTime = (file as any).thumbnailTime;
				const thumbnailPath = (file as any).thumbnailPath as string | null;
				const processingStatus = (file as any).processingStatus as string | null;
				const hlsUrl = (file as any).hlsUrl as string | null;
				const optimizedVideoUrl = (file as any).optimizedVideoUrl as string | null;
				const optimizedUrls = (file as any).optimizedUrls as Record<string, string> | null;

				let images: MediaFileInfo["images"];
				let video: MediaFileInfo["video"];

				if (file.mimeType.startsWith("video/")) {
					// For videos, use thumbnailPath if available (served via ImageKit)
					if (thumbnailPath) {
						const thumbnailUrlSet = storageService.generateUrlSet(thumbnailPath, "image/jpeg");
						images = thumbnailUrlSet.images;
					} else {
						images = { original: "", thumbnail: "", small: "", medium: "", large: "" };
					}

					// Generate video URLs
					const videoUrlSet = file.uuid ? storageService.generateUrlSet(file.uuid, file.mimeType) : emptyUrlSet;

					// Use optimized video URLs if processing is complete
					if (processingStatus === "completed" && (hlsUrl || optimizedVideoUrl)) {
						const optimizedMp4 = optimizedVideoUrl || optimizedUrls?.mp4_1080p || optimizedUrls?.mp4_720p || "";
						video = {
							default: toCloudFrontUrl(hlsUrl || optimizedMp4) || videoUrlSet.video?.default || "",
							provider: videoUrlSet.video?.provider || "",
							original: videoUrlSet.video?.original || "",
							hls: toCloudFrontUrl(hlsUrl),
							mp4: toCloudFrontUrl(optimizedMp4),
						};
					} else {
						video = videoUrlSet.video;
					}
				} else {
					// For non-video files, use standard URL generation
					const urlSet = file.uuid
						? storageService.generateUrlSet(file.uuid, file.mimeType, thumbnailTime)
						: emptyUrlSet;
					images = urlSet.images;
					video = urlSet.video;
				}

				return {
					id: file.id,
					filename: file.filename,
					originalName: file.originalName,
					mimeType: file.mimeType,
					size: Number(file.size),
					uuid: file.uuid,
					images,
					video,
					category: FileValidator.getFileCategory(file.mimeType),
					folderId: file.folderId || undefined,
					altText: file.altText || undefined,
					thumbnailTime: thumbnailTime || undefined,
					processingStatus: processingStatus || undefined,
					usageCount,
					createdAt: file.createdAt,
					updatedAt: file.updatedAt,
				};
			});
			return {
				files: fileInfos,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error) {
			console.error("Error searching media:", error);
			throw new Error("Failed to search media files");
		}
	}

	/** List trashed files with pagination */
	async getTrashedFiles(
		page: number = 1,
		limit: number = 20,
		search?: string,
		type?: "image" | "video" | "file",
		mimeTypes?: string[],
	): Promise<{
		files: MediaFileInfo[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		const skip = (page - 1) * limit;
		const where: any = { deletedAt: { not: null }, purgedAt: null } as any;
		if (search) {
			where.OR = [{ originalName: { contains: search } }, { filename: { contains: search } }];
		}
		if (type) {
			if (type === "image") where.mimeType = { startsWith: "image/" };
			else if (type === "video") where.mimeType = { startsWith: "video/" };
			else
				where.AND = [{ NOT: { mimeType: { startsWith: "image/" } } }, { NOT: { mimeType: { startsWith: "video/" } } }];
		}
		if (mimeTypes && mimeTypes.length > 0) where.mimeType = { in: mimeTypes };

		const [files, total] = await Promise.all([
			prisma.mediaFile.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					filename: true,
					originalName: true,
					mimeType: true,
					size: true,
					uuid: true,
					folderId: true,
					altText: true,
					// @ts-ignore - these fields exist but aren't in Prisma types yet
					thumbnailTime: true,
					// @ts-ignore
					thumbnailPath: true,
					// @ts-ignore
					processingStatus: true,
					// @ts-ignore
					hlsUrl: true,
					// @ts-ignore
					optimizedVideoUrl: true,
					// @ts-ignore
					optimizedUrls: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			prisma.mediaFile.count({ where }),
		]);

		const fileInfos: MediaFileInfo[] = files.map((file) => {
			const thumbnailTime = (file as any).thumbnailTime;
			const thumbnailPath = (file as any).thumbnailPath as string | null;
			const processingStatus = (file as any).processingStatus as string | null;
			const hlsUrl = (file as any).hlsUrl as string | null;
			const optimizedVideoUrl = (file as any).optimizedVideoUrl as string | null;
			const optimizedUrls = (file as any).optimizedUrls as Record<string, string> | null;

			let images: MediaFileInfo["images"];
			let video: MediaFileInfo["video"];

			if (file.mimeType.startsWith("video/")) {
				// For videos, use thumbnailPath if available (served via ImageKit)
				if (thumbnailPath) {
					const thumbnailUrlSet = storageService.generateUrlSet(thumbnailPath, "image/jpeg");
					images = thumbnailUrlSet.images;
				} else {
					images = { original: "", thumbnail: "", small: "", medium: "", large: "" };
				}

				// Generate video URLs
				const videoUrlSet = file.uuid ? storageService.generateUrlSet(file.uuid, file.mimeType) : emptyUrlSet;

				// Use optimized video URLs if processing is complete
				if (processingStatus === "completed" && (hlsUrl || optimizedVideoUrl)) {
					const optimizedMp4 = optimizedVideoUrl || optimizedUrls?.mp4_1080p || optimizedUrls?.mp4_720p || "";
					video = {
						default: toCloudFrontUrl(hlsUrl || optimizedMp4) || videoUrlSet.video?.default || "",
						provider: videoUrlSet.video?.provider || "",
						original: videoUrlSet.video?.original || "",
						hls: toCloudFrontUrl(hlsUrl),
						mp4: toCloudFrontUrl(optimizedMp4),
					};
				} else {
					video = videoUrlSet.video;
				}
			} else {
				// For non-video files, use standard URL generation
				const urlSet = file.uuid ? storageService.generateUrlSet(file.uuid, file.mimeType, thumbnailTime) : emptyUrlSet;
				images = urlSet.images;
				video = urlSet.video;
			}

			return {
				id: file.id,
				filename: file.filename,
				originalName: file.originalName,
				mimeType: file.mimeType,
				size: Number(file.size),
				uuid: file.uuid,
				images,
				video,
				category: FileValidator.getFileCategory(file.mimeType),
				folderId: file.folderId || undefined,
				altText: file.altText || undefined,
				thumbnailTime: thumbnailTime || undefined,
				usageCount: 0,
				createdAt: file.createdAt,
				updatedAt: file.updatedAt,
			};
		});

		return {
			files: fileInfos,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	/** List trashed folders (flat list) */
	async getTrashedFolders(): Promise<FolderInfo[]> {
		const folders = await prisma.mediaFolder.findMany({
			where: { deletedAt: { not: null }, purgedAt: null } as any,
			orderBy: { path: "asc" },
		});
		return folders.map((folder) => ({
			id: folder.id,
			name: folder.name,
			parentId: folder.parentId || undefined,
			path: folder.path,
			fileCount: 0,
			subfolderCount: 0,
			totalFileCount: 0,
			createdAt: folder.createdAt,
			updatedAt: folder.updatedAt,
		}));
	}

	/** Get count of trashed files */
	async getTrashedFilesCount(): Promise<number> {
		return prisma.mediaFile.count({
			where: { deletedAt: { not: null }, purgedAt: null } as any,
		});
	}

	/** Restore a folder from Trash */
	async restoreFolder(id: number): Promise<void> {
		await prisma.mediaFolder.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	/** Purge a folder (hide permanently from UI) */
	async purgeFolder(id: number): Promise<void> {
		await prisma.mediaFolder.update({
			where: { id },
			data: { purgedAt: new Date() } as any,
		});
	}

	/**
	 * Delete folder with all its contents recursively
	 */
	async deleteFolderRecursive(folderId: number): Promise<void> {
		try {
			// Get all subfolders
			const subfolders = await prisma.mediaFolder.findMany({
				where: { parentId: folderId, purgedAt: null } as any,
			});

			// Recursively delete all subfolders
			for (const subfolder of subfolders) {
				await this.deleteFolderRecursive(subfolder.id);
			}

			// Get all files in this folder
			const files = await prisma.mediaFile.findMany({
				where: { folderId, purgedAt: null } as any,
			});

			// Delete all files
			for (const file of files) {
				await prisma.mediaFile.update({
					where: { id: file.id },
					data: { deletedAt: new Date() } as any,
				});
			}

			// Soft-delete the folder itself
			await prisma.mediaFolder.update({
				where: { id: folderId },
				data: { deletedAt: new Date() } as any,
			});
		} catch (error) {
			console.error(`Error deleting folder ${folderId}:`, error);
			throw error;
		}
	}

	/**
	 * Bulk delete items (files and folders)
	 */
	async bulkDeleteItems(
		fileIds: number[] = [],
		folderIds: number[] = [],
	): Promise<{
		deletedFiles: number[];
		deletedFolders: number[];
		failed: Array<{ id: number; type: "file" | "folder"; error: string }>;
	}> {
		const deletedFiles: number[] = [];
		const deletedFolders: number[] = [];
		const failed: Array<{
			id: number;
			type: "file" | "folder";
			error: string;
		}> = [];

		// Delete files
		for (const fileId of fileIds) {
			try {
				await this.deleteFile(fileId);
				deletedFiles.push(fileId);
			} catch (error) {
				failed.push({
					id: fileId,
					type: "file",
					error: error instanceof Error ? error.message : "Delete failed",
				});
			}
		}

		// Delete folders
		for (const folderId of folderIds) {
			try {
				await this.deleteFolderRecursive(folderId);
				deletedFolders.push(folderId);
			} catch (error) {
				failed.push({
					id: folderId,
					type: "folder",
					error: error instanceof Error ? error.message : "Delete failed",
				});
			}
		}

		return { deletedFiles, deletedFolders, failed };
	}

	/**
	 * Bulk move items (files and folders) to a new folder
	 */
	async bulkMoveItems(
		fileIds: number[] = [],
		folderIds: number[] = [],
		targetFolderId?: number,
	): Promise<{
		movedFiles: number[];
		movedFolders: number[];
		failed: Array<{ id: number; type: "file" | "folder"; error: string }>;
	}> {
		const movedFiles: number[] = [];
		const movedFolders: number[] = [];
		const failed: Array<{
			id: number;
			type: "file" | "folder";
			error: string;
		}> = [];

		// For files: if no target folder specified, use Uncategorized folder
		// For folders: allow null targetFolderId (move to root)
		let fileFolderId = targetFolderId;
		if (!fileFolderId && fileIds.length > 0) {
			fileFolderId = await this.getUncategorizedFolder();
		}

		// Validate target folder exists if specified and capture its path
		let targetParentPath: string | undefined;
		if (targetFolderId) {
			const targetFolder = await prisma.mediaFolder.findUnique({
				where: { id: targetFolderId },
			});
			if (!targetFolder) {
				throw new Error("Target folder not found");
			}

			// Check if target folder is Uncategorized - folders cannot be moved into it
			if (targetFolder.name === "Uncategorized" && targetFolder.parentId === null && folderIds.length > 0) {
				throw new Error("Folders cannot be moved into Uncategorized folder");
			}

			targetParentPath = targetFolder.path;
		}

		// Move files
		for (const fileId of fileIds) {
			try {
				await this.moveFile(fileId, fileFolderId);
				movedFiles.push(fileId);
			} catch (error) {
				failed.push({
					id: fileId,
					type: "file",
					error: error instanceof Error ? error.message : "Move failed",
				});
			}
		}

		// Move folders
		for (const folderId of folderIds) {
			try {
				// Check if folder is Uncategorized
				const folder = await prisma.mediaFolder.findUnique({
					where: { id: folderId },
				});

				if (folder && folder.name === "Uncategorized" && folder.parentId === null) {
					throw new Error("Cannot move Uncategorized folder");
				}

				if (!folder) {
					throw new Error("Folder not found");
				}

				// Check for circular reference
				if (targetFolderId) {
					const isCircular = await this.checkCircularReference(folderId, targetFolderId);
					if (isCircular) {
						throw new Error("Cannot move folder into itself or its subfolder");
					}
				}

				// Compute new path based on target parent path
				const newPath = (targetParentPath ? `${targetParentPath}/` : "") + folder.name;
				// Update folder parent and path
				await prisma.mediaFolder.update({
					where: { id: folderId },
					data: { parentId: targetFolderId || null, path: newPath },
				});
				// Update all child folder paths recursively
				await this.updateChildFolderPaths(folderId, newPath);
				movedFolders.push(folderId);
			} catch (error) {
				failed.push({
					id: folderId,
					type: "folder",
					error: error instanceof Error ? error.message : "Move failed",
				});
			}
		}

		return { movedFiles, movedFolders, failed };
	}

	/**
	 * Check if moving a folder would create a circular reference
	 */
	private async checkCircularReference(folderId: number, targetFolderId: number): Promise<boolean> {
		if (folderId === targetFolderId) {
			return true;
		}

		const targetFolder = await prisma.mediaFolder.findUnique({
			where: { id: targetFolderId },
		});

		if (!targetFolder || !targetFolder.parentId) {
			return false;
		}

		return this.checkCircularReference(folderId, targetFolder.parentId);
	}

	/**
	 * Create a file record in database (for presigned URL uploads)
	 * Called after file is directly uploaded to S3
	 */
	async createFileRecord(data: {
		uuid: string;
		filename: string;
		originalName: string;
		mimeType: string;
		size: number;
		folderId?: number;
	}): Promise<MediaUploadResult> {
		try {
			// If no folderId provided, use Uncategorized folder
			let folderId = data.folderId;
			if (!folderId) {
				folderId = await this.getUncategorizedFolder();
			}

			// Humanize original_name for display
			const humanizedName = humanizeFilename(data.originalName);

			// Create database record
			const mediaFile = await prisma.mediaFile.create({
				data: {
					filename: data.filename,
					originalName: humanizedName,
					mimeType: data.mimeType,
					size: BigInt(data.size),
					uuid: data.uuid,
					folderId,
					thumbnailTime: data.mimeType.startsWith("video/") ? 1 : undefined,
					// Set initial processing status for videos
					processingStatus: data.mimeType.startsWith("video/") ? "pending" : undefined,
				} as any,
			});

			// Start video processing for video files (async, don't wait)
			if (data.mimeType.startsWith("video/")) {
				videoProcessingService
					.startProcessing(mediaFile.id)
					.then((jobId) => {
						// If no job was created (not processable), clear the pending status
						if (!jobId) {
							prisma.mediaFile
								.update({
									where: { id: mediaFile.id },
									data: { processingStatus: null },
								})
								.catch(() => {});
						}
					})
					.catch((error) => {
						console.error(`[MediaService] Failed to start video processing for file ${mediaFile.id}:`, error);
					});
			}

			// Generate URLs
			const urlSet = storageService.generateUrlSet(data.uuid, data.mimeType);

			return {
				id: mediaFile.id,
				filename: mediaFile.filename,
				originalName: mediaFile.originalName,
				mimeType: mediaFile.mimeType,
				size: Number(mediaFile.size),
				uuid: mediaFile.uuid,
				images: urlSet.images,
				video: urlSet.video,
				category: FileValidator.getFileCategory(data.mimeType),
				folderId: mediaFile.folderId || undefined,
				createdAt: mediaFile.createdAt,
			};
		} catch (error) {
			console.error("Error creating file record:", error);
			throw error;
		}
	}

	/**
	 * Get processing status for multiple video files (batch)
	 * Returns status, thumbnailPath, and URLs for completed videos
	 */
	async getProcessingStatuses(fileIds: number[]): Promise<
		Record<
			number,
			{
				processingStatus: string | null;
				thumbnailPath: string | null;
				images: ImageUrlSet | null;
				hlsUrl: string | null;
				optimizedVideoUrl: string | null;
			}
		>
	> {
		const files = (await prisma.mediaFile.findMany({
			where: {
				id: { in: fileIds },
				mimeType: { startsWith: "video/" },
			},
			select: {
				id: true,
				processingStatus: true,
				thumbnailPath: true,
				hlsUrl: true,
				optimizedVideoUrl: true,
			} as any,
		})) as unknown as Array<{
			id: number;
			processingStatus: string | null;
			thumbnailPath: string | null;
			hlsUrl: string | null;
			optimizedVideoUrl: string | null;
		}>;

		const result: Record<
			number,
			{
				processingStatus: string | null;
				thumbnailPath: string | null;
				images: ImageUrlSet | null;
				hlsUrl: string | null;
				optimizedVideoUrl: string | null;
			}
		> = {};

		for (const file of files) {
			let images: ImageUrlSet | null = null;
			if (file.thumbnailPath) {
				const thumbnailUrlSet = storageService.generateUrlSet(file.thumbnailPath, "image/jpeg");
				images = thumbnailUrlSet.images;
			}

			result[file.id] = {
				processingStatus: file.processingStatus,
				thumbnailPath: file.thumbnailPath,
				images,
				hlsUrl: file.hlsUrl,
				optimizedVideoUrl: file.optimizedVideoUrl,
			};
		}

		return result;
	}
}

// Export singleton instance
export const mediaService = new MediaService();
