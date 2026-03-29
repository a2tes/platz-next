import { Request, Response, NextFunction } from "express";
import { mediaService } from "../services/mediaService";
import { ActivityService } from "../services/activityService";
import { s3Service } from "../services/s3Service";
import { clipProcessingService } from "../services/clipProcessingService";
import { clipJobService } from "../services/clipJobService";
import { VIDEO_PROCESSING_CONFIG } from "../config/videoProcessing";
import { z } from "zod";

/**
 * Enrich a clip job record with full CDN URLs
 */
function enrichClipWithUrls(clip: any) {
	if (!clip) return clip;
	const domain = VIDEO_PROCESSING_CONFIG.cloudfront?.domain;
	if (!domain) return clip;

	return {
		...clip,
		outputUrl: clip.outputPath ? `https://${domain}/${clip.outputPath}` : clip.outputUrl || null,
		thumbnailUrl: clip.thumbnailPath ? `https://${domain}/${clip.thumbnailPath}` : clip.thumbnailUrl || null,
	};
}

// Helper function for API responses
const apiResponse = {
	success: (data: any, meta?: any) => ({
		success: true,
		data,
		meta: { timestamp: new Date().toISOString(), ...meta },
	}),
	error: (message: string, code: string) => ({
		success: false,
		error: {
			code,
			message,
			timestamp: new Date().toISOString(),
		},
	}),
};

// Validation schemas
const uploadFileSchema = z.object({
	folderId: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : undefined)),
});

const createFolderSchema = z.object({
	name: z.string().min(1).max(191),
	parentId: z.number().optional(),
});

const moveFileSchema = z.object({
	fileId: z.number(),
	folderId: z.number().optional(),
});

const moveFilesSchema = z.object({
	fileIds: z.array(z.number()).min(1),
	folderId: z.number().optional(),
});

const deleteFilesSchema = z.object({
	fileIds: z.array(z.number()).min(1),
});

const getFilesSchema = z.object({
	folderId: z.number().optional(),
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	type: z.enum(["image", "video", "file"]).optional(),
	mimeTypes: z
		.string()
		.optional()
		.transform((val) => (val ? val.split(",") : undefined)),
});

const getTrashedFilesSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	search: z.string().optional(),
	type: z.enum(["image", "video", "file"]).optional(),
	mimeTypes: z
		.string()
		.optional()
		.transform((val) => (val ? val.split(",") : undefined)),
});

export class MediaController {
	// Format a raw path like "/images/sub" to "images > sub"; fallback to a name or "root"
	private formatPathForDescription(path?: string, fallbackName?: string): string {
		const pretty = path ? path.replace(/^\/+/, "").split("/").filter(Boolean).join(" › ") : undefined;
		return pretty || fallbackName || "Root";
	}
	/**
	 * Upload single file
	 */
	async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const file = req.file;
			if (!file) {
				res.status(400).json(apiResponse.error("No file uploaded", "NO_FILE"));
				return;
			}

			const { folderId } = uploadFileSchema.parse(req.body);

			const result = await mediaService.uploadFile(file.buffer, file.originalname, file.mimetype, folderId);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "media",
				itemType: "file",
				itemId: result.id,
				itemTitle: result.originalName,
				description: `**${result.originalName}** file has been uploaded`,
			});

			res.status(201).json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Upload multiple files
	 */
	async uploadFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const files = req.files as Express.Multer.File[];
			if (!files || files.length === 0) {
				res.status(400).json(apiResponse.error("No files uploaded", "NO_FILES"));
				return;
			}

			const { folderId } = uploadFileSchema.parse(req.body);

			const fileData = files.map((file) => ({
				buffer: file.buffer,
				originalName: file.originalname,
				mimeType: file.mimetype,
			}));

			const results = await mediaService.uploadFiles(fileData, folderId);

			// Log activity for each uploaded file
			for (const result of results) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "create",
					module: "media",
					itemType: "file",
					itemId: result.id,
					itemTitle: result.originalName,
					description: `**${result.originalName}** file has been uploaded`,
				});
			}

			res.status(201).json(
				apiResponse.success({
					uploaded: results,
					count: results.length,
				}),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get file by ID
	 */
	async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			const file = await mediaService.getFileById(fileId);
			if (!file) {
				res.status(404).json(apiResponse.error("File not found", "FILE_NOT_FOUND"));
				return;
			}

			res.json(apiResponse.success(file));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Update file metadata
	 */
	async updateFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			const { altText, originalName } = req.body;

			// Get old file info for logging
			const oldFile = await mediaService.getFileById(fileId);

			const file = await mediaService.updateFileMetadata(fileId, {
				altText,
				originalName,
			});

			// Log activity
			if (oldFile) {
				if (originalName && originalName !== oldFile.originalName) {
					await ActivityService.log({
						userId: req.user!.id,
						action: "update",
						module: "media",
						itemType: "file",
						itemId: fileId,
						itemTitle: file.originalName,
						description: `**${oldFile.originalName}** file has been renamed to **${file.originalName}**`,
					});
				}

				if (altText !== undefined && altText !== oldFile.altText) {
					await ActivityService.log({
						userId: req.user!.id,
						action: "update",
						module: "media",
						itemType: "file",
						itemId: fileId,
						itemTitle: file.originalName,
						description: `**${file.originalName}** file alt text has been updated`,
					});
				}
			}

			res.json(apiResponse.success(file));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Update file metadata
	 */
	async updateFileMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			const schema = z.object({
				altText: z.string().optional(),
				originalName: z.string().optional(),
				thumbnailTime: z.number().optional(),
			});

			const data = schema.parse(req.body);

			// Get old file info for logging
			const oldFile = await mediaService.getFileById(fileId);

			const result = await mediaService.updateFileMetadata(fileId, data);

			// Log activity
			if (oldFile) {
				if (data.originalName && data.originalName !== oldFile.originalName) {
					await ActivityService.log({
						userId: req.user!.id,
						action: "update",
						module: "media",
						itemType: "file",
						itemId: fileId,
						itemTitle: result.originalName,
						description: `**${oldFile.originalName}** file has been renamed to **${result.originalName}**`,
					});
				}

				if (data.altText !== undefined && data.altText !== oldFile.altText) {
					await ActivityService.log({
						userId: req.user!.id,
						action: "update",
						module: "media",
						itemType: "file",
						itemId: fileId,
						itemTitle: result.originalName,
						description: `**${result.originalName}** file alt text has been updated`,
					});
				}
			} else {
				await ActivityService.log({
					userId: req.user!.id,
					action: "update",
					module: "media",
					itemType: "file",
					itemId: fileId,
					itemTitle: result.originalName,
					description: `**${result.originalName}** file metadata has been updated`,
				});
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Upload a video thumbnail from client-captured canvas frame
	 */
	async uploadVideoThumbnail(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			// Check if thumbnail was uploaded
			if (!req.file) {
				res.status(400).json(apiResponse.error("No thumbnail image provided", "NO_THUMBNAIL"));
				return;
			}

			// Get the media file to verify it's a video
			const mediaFile = await mediaService.getFileById(fileId);
			if (!mediaFile) {
				res.status(404).json(apiResponse.error("File not found", "NOT_FOUND"));
				return;
			}

			if (!mediaFile.mimeType.startsWith("video/")) {
				res.status(400).json(apiResponse.error("Thumbnails can only be set for video files", "NOT_VIDEO"));
				return;
			}

			// Parse thumbnail time from body
			const thumbnailTime = req.body.thumbnailTime ? parseFloat(req.body.thumbnailTime) : 0;

			// Generate timestamp for cache busting
			const timestamp = Date.now();

			// Upload thumbnail to S3
			const thumbnailPath = await s3Service.uploadVideoThumbnail(req.file.buffer, mediaFile.uuid, timestamp);

			// Update media file with thumbnail path and time
			const result = await mediaService.updateFileMetadata(fileId, {
				thumbnailPath,
				thumbnailTime,
			});

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "media",
				itemType: "file",
				itemId: fileId,
				itemTitle: mediaFile.originalName,
				description: `Video thumbnail has been set for **${mediaFile.originalName}**`,
			});

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get files in folder with pagination
	 */
	async getFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getFilesSchema.parse({
				folderId: req.query.folderId ? parseInt(req.query.folderId as string) : undefined,
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
				type: req.query.type as string,
				mimeTypes: req.query.mimeTypes as string,
			});

			const result = await mediaService.getFilesInFolder(
				query.folderId,
				query.page,
				query.limit,
				query.search,
				query.type,
				query.mimeTypes,
			);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get images only
	 */
	async getImages(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getFilesSchema.omit({ folderId: true, type: true, mimeTypes: true }).parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
			});

			const result = await mediaService.getFilesByType(
				"image",
				undefined, // folderId is removed
				query.page,
				query.limit,
				query.search,
			);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get videos only
	 */
	async getVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getFilesSchema.omit({ folderId: true, type: true, mimeTypes: true }).parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
			});

			const result = await mediaService.getFilesByType(
				"video",
				undefined, // folderId is removed
				query.page,
				query.limit,
				query.search,
			);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get documents only (excluding images and videos)
	 */
	async getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getFilesSchema.omit({ folderId: true, type: true, mimeTypes: true }).parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
			});

			const result = await mediaService.getFilesByType(
				"document",
				undefined, // folderId is removed
				query.page,
				query.limit,
				query.search,
			);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get files in folders (all types)
	 */
	async getFolderFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getFilesSchema.parse({
				folderId: req.query.folderId ? parseInt(req.query.folderId as string) : undefined,
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
			});

			const result = await mediaService.getFilesByType("all", query.folderId, query.page, query.limit, query.search);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete single file
	 */
	async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			// Get file info before deletion for logging
			const file = await mediaService.getFileById(fileId);
			if (!file) {
				res.status(404).json(apiResponse.error("File not found", "FILE_NOT_FOUND"));
				return;
			}

			await mediaService.deleteFile(fileId);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "media",
				itemType: "file",
				itemId: fileId,
				itemTitle: file.originalName,
				description: `**${file.originalName}** file has been deleted`,
			});

			res.json(apiResponse.success({ message: "File deleted successfully" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete multiple files
	 */
	async deleteFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { fileIds } = deleteFilesSchema.parse(req.body);

			// Get file info before deletion for logging
			const files = await Promise.all(fileIds.map((id) => mediaService.getFileById(id)));

			const result = await mediaService.deleteFiles(fileIds);

			// Log activity for successfully deleted files
			for (const fileId of result.deleted) {
				const file = files.find((f) => f?.id === fileId);
				if (file) {
					await ActivityService.log({
						userId: req.user!.id,
						action: "delete",
						module: "media",
						itemType: "file",
						itemId: fileId,
						itemTitle: file.originalName,
						description: `**${file.originalName}** file has been deleted`,
					});
				}
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Move single file
	 */
	async moveFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			const { folderId } = moveFileSchema.parse({ fileId, ...req.body });

			const result = await mediaService.moveFile(fileId, folderId);

			// Resolve destination name
			let destination = "Root";
			let destinationPath: string | undefined;
			if (folderId) {
				try {
					const folders = await mediaService.getFolderTree();
					const target = folders.find((f) => f.id === folderId);
					destination = target?.name || `folder`;
					destinationPath = target?.path;
					// Log activity with destination details
				} catch {}
			}

			// Log activity with destination (pretty path) and metadata
			const prettyDest = this.formatPathForDescription(destinationPath, destination);
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "media",
				itemType: "file",
				itemId: fileId,
				itemTitle: result.originalName,
				description: `**${result.originalName}** file has been moved to **${prettyDest}**`,
			});

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Move multiple files
	 */
	async moveFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { fileIds, folderId } = moveFilesSchema.parse(req.body);

			const result = await mediaService.moveFiles(fileIds, folderId);

			// Resolve destination name
			let destination = "Root";
			let destinationPath: string | undefined;
			if (folderId) {
				try {
					const folders = await mediaService.getFolderTree();
					const target = folders.find((f) => f.id === folderId);
					destination = target?.name || `Folder`;
					destinationPath = target?.path;
				} catch {}
			}

			// Log activity for successfully moved files
			const prettyDest = this.formatPathForDescription(destinationPath, destination);
			for (const fileId of result.moved) {
				const file = await mediaService.getFileById(fileId);
				if (file) {
					await ActivityService.log({
						userId: req.user!.id,
						action: "update",
						module: "media",
						itemType: "file",
						itemId: fileId,
						itemTitle: file.originalName,
						description: `**${file.originalName}** file has been moved to **${prettyDest}**`,
					});
				}
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Create folder
	 */
	async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { name, parentId } = createFolderSchema.parse(req.body);

			const folder = await mediaService.createFolder(name, parentId);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "media",
				itemType: "folder",
				itemId: folder.id,
				itemTitle: folder.name,
				description: `**${folder.name}** folder has been created`,
			});

			res.status(201).json(apiResponse.success(folder));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get folder tree
	 */
	async getFolderTree(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const [folders, trashCount] = await Promise.all([
				mediaService.getFolderTree(),
				mediaService.getTrashedFilesCount(),
			]);
			res.json(apiResponse.success({ folders, trashCount }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete folder
	 */
	async deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const folderId = parseInt(req.params.id as string);
			if (isNaN(folderId)) {
				res.status(400).json(apiResponse.error("Invalid folder ID", "INVALID_ID"));
				return;
			}

			// Check if folder exists and get info for logging
			const folders = await mediaService.getFolderTree();
			const folder = folders.find((f) => f.id === folderId);
			if (!folder) {
				res.status(404).json(apiResponse.error("Folder not found", "FOLDER_NOT_FOUND"));
				return;
			}

			// Check if folder is empty
			if (folder.fileCount > 0 || folder.subfolderCount > 0) {
				res.status(400).json(apiResponse.error("Cannot delete non-empty folder", "FOLDER_NOT_EMPTY"));
				return;
			}

			// Delete folder from database
			await mediaService.deleteFolder(folderId);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "media",
				itemType: "folder",
				itemId: folderId,
				itemTitle: folder.name,
				description: `**${folder.name}** folder has been deleted`,
			});

			res.json(apiResponse.success({ message: "Folder deleted successfully" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Rename folder
	 */
	async renameFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const folderId = parseInt(req.params.id as string);
			if (isNaN(folderId)) {
				res.status(400).json(apiResponse.error("Invalid folder ID", "INVALID_ID"));
				return;
			}

			const { name } = z.object({ name: z.string().min(1).max(191) }).parse(req.body);

			// Get old folder name for logging
			const folders = await mediaService.getFolderTree();
			const oldFolder = folders.find((f) => f.id === folderId);
			const oldName = oldFolder?.name || "Folder";

			const result = await mediaService.renameFolder(folderId, name);

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "update",
				module: "media",
				itemType: "folder",
				itemId: folderId,
				itemTitle: result.name,
				description: `**${oldName}** folder has been renamed to **${result.name}**`,
			});

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get media usage statistics
	 */
	async getMediaStats(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const stats = await mediaService.getMediaStats();
			res.json(apiResponse.success(stats));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Search media files
	 */
	async searchMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = z
				.object({
					q: z.string().min(1),
					type: z.enum(["image", "video", "document", "all"]).default("all"),
					page: z.number().min(1).default(1),
					limit: z.number().min(1).max(100).default(20),
				})
				.parse({
					q: req.query.q,
					type: req.query.type || "all",
					page: req.query.page ? parseInt(req.query.page as string) : 1,
					limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				});

			const result = await mediaService.searchMedia(
				query.q,
				query.type === "all" ? undefined : query.type,
				query.page,
				query.limit,
			);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Trash: list trashed files
	 */
	async getTrashedFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const query = getTrashedFilesSchema.parse({
				page: req.query.page ? parseInt(req.query.page as string) : 1,
				limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
				search: req.query.search as string,
				type: req.query.type as string,
				mimeTypes: req.query.mimeTypes as string,
			});

			const result = await mediaService.getTrashedFiles(
				query.page,
				query.limit,
				query.search,
				query.type,
				query.mimeTypes,
			);

			res.json(apiResponse.success(result.files, { pagination: result.pagination }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Trash: list trashed folders
	 */
	async getTrashedFolders(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const folders = await mediaService.getTrashedFolders();
			res.json(apiResponse.success(folders));
		} catch (error) {
			next(error);
		}
	}

	/** Restore a trashed file */
	async restoreFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			await mediaService.restoreFile(fileId);

			const file = await mediaService.getFileById(fileId);
			const title = file?.originalName ?? `File ${fileId}`;
			await ActivityService.log({
				userId: req.user!.id,
				action: "restore",
				module: "media",
				itemType: "file",
				itemId: fileId,
				itemTitle: title,
				description: `**${title}** file has been restored`,
			});

			res.json(apiResponse.success({ message: "File restored" }));
		} catch (error) {
			next(error);
		}
	}

	/** Purge (hide permanently) a file */
	async purgeFile(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			await mediaService.purgeFile(fileId);

			const file = await mediaService.getFileById(fileId);
			const title = file?.originalName ?? `File ${fileId}`;
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "media",
				itemType: "file",
				itemId: fileId,
				itemTitle: title,
				description: `**${title}** file has been permanently deleted`,
			});

			res.json(apiResponse.success({ message: "File permanently deleted" }));
		} catch (error) {
			next(error);
		}
	}

	/** Bulk restore files from trash */
	async bulkRestoreFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { fileIds } = req.body;
			if (!Array.isArray(fileIds) || fileIds.length === 0) {
				res.status(400).json(apiResponse.error("fileIds array is required", "INVALID_INPUT"));
				return;
			}

			const result = await mediaService.bulkRestoreFiles(fileIds);

			// Log activity for restored files
			if (result.restored.length > 0) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "update",
					module: "media",
					itemType: "file",
					itemId: result.restored[0],
					itemTitle: `${result.restored.length} files`,
					description: `Restored ${result.restored.length} file(s) from trash`,
				});
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/** Bulk purge files (permanently delete) */
	async bulkPurgeFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { fileIds } = req.body;
			if (!Array.isArray(fileIds) || fileIds.length === 0) {
				res.status(400).json(apiResponse.error("fileIds array is required", "INVALID_INPUT"));
				return;
			}

			const result = await mediaService.bulkPurgeFiles(fileIds);

			// Log activity for purged files
			if (result.purged.length > 0) {
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "media",
					itemType: "file",
					itemId: result.purged[0],
					itemTitle: `${result.purged.length} files`,
					description: `Permanently deleted ${result.purged.length} file(s)`,
				});
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/** Restore a trashed folder */
	async restoreFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const folderId = parseInt(req.params.id as string);
			if (isNaN(folderId)) {
				res.status(400).json(apiResponse.error("Invalid folder ID", "INVALID_ID"));
				return;
			}

			await mediaService.restoreFolder(folderId);

			// Try to resolve folder name from trashed list (before restore)
			const trashedFolders = await mediaService.getTrashedFolders();
			const folder = trashedFolders.find((f) => f.id === folderId);
			const title = folder?.name ?? `Folder ${folderId}`;
			await ActivityService.log({
				userId: req.user!.id,
				action: "restore",
				module: "media",
				itemType: "folder",
				itemId: folderId,
				itemTitle: title,
				description: `**${title}** folder has been restored`,
			});

			res.json(apiResponse.success({ message: "Folder restored" }));
		} catch (error) {
			next(error);
		}
	}

	/** Purge (hide permanently) a folder */
	async purgeFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const folderId = parseInt(req.params.id as string);
			if (isNaN(folderId)) {
				res.status(400).json(apiResponse.error("Invalid folder ID", "INVALID_ID"));
				return;
			}

			await mediaService.purgeFolder(folderId);

			// Try to resolve folder name from trashed list
			const trashedFolders = await mediaService.getTrashedFolders();
			const folder = trashedFolders.find((f) => f.id === folderId);
			const title = folder?.name ?? `Folder ${folderId}`;
			await ActivityService.log({
				userId: req.user!.id,
				action: "delete",
				module: "media",
				itemType: "folder",
				itemId: folderId,
				itemTitle: title,
				description: `**${title}** folder has been permanently deleted`,
			});

			res.json(apiResponse.success({ message: "Folder permanently deleted" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Bulk delete items (files and folders)
	 */
	async bulkDeleteItems(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({
				fileIds: z.array(z.number()).optional().default([]),
				folderIds: z.array(z.number()).optional().default([]),
			});

			const { fileIds, folderIds } = schema.parse(req.body);

			if (fileIds.length === 0 && folderIds.length === 0) {
				res.status(400).json(apiResponse.error("No items to delete", "NO_ITEMS"));
				return;
			}

			// Prefetch names for nicer activity titles
			const fileNameMap = new Map<number, string>();
			await Promise.all(
				fileIds.map(async (id) => {
					const f = await mediaService.getFileById(id);
					if (f?.originalName) fileNameMap.set(id, f.originalName);
				}),
			);
			const folderNameMap = new Map<number, string>();
			if (folderIds.length > 0) {
				const folders = await mediaService.getFolderTree();
				for (const id of folderIds) {
					const f = folders.find((x) => x.id === id);
					if (f?.name) folderNameMap.set(id, f.name);
				}
			}

			const result = await mediaService.bulkDeleteItems(fileIds, folderIds);

			// Log activity for successfully deleted items
			for (const fileId of result.deletedFiles) {
				const title = fileNameMap.get(fileId) ?? `File ${fileId}`;
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "media",
					itemType: "file",
					itemId: fileId,
					itemTitle: title,
					description: `**${title}** file has been deleted`,
				});
			}

			for (const folderId of result.deletedFolders) {
				const title = folderNameMap.get(folderId) ?? `Folder ${folderId}`;
				await ActivityService.log({
					userId: req.user!.id,
					action: "delete",
					module: "media",
					itemType: "folder",
					itemId: folderId,
					itemTitle: title,
					description: `**${title}** folder has been deleted`,
				});
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Bulk move items (files and folders)
	 */
	async bulkMoveItems(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({
				fileIds: z.array(z.number()).optional().default([]),
				folderIds: z.array(z.number()).optional().default([]),
				targetFolderId: z.number().optional(),
			});

			const { fileIds, folderIds, targetFolderId } = schema.parse(req.body);

			if (fileIds.length === 0 && folderIds.length === 0) {
				res.status(400).json(apiResponse.error("No items to move", "NO_ITEMS"));
				return;
			}

			// Prefetch names for nicer activity titles
			const fileNameMap = new Map<number, string>();
			await Promise.all(
				fileIds.map(async (id) => {
					const f = await mediaService.getFileById(id);
					if (f?.originalName) fileNameMap.set(id, f.originalName);
				}),
			);
			const folderNameMap = new Map<number, string>();
			let targetFolderName: string | undefined;
			let targetFolderPath: string | undefined;
			if (folderIds.length > 0 || targetFolderId) {
				const folders = await mediaService.getFolderTree();
				for (const id of folderIds) {
					const f = folders.find((x) => x.id === id);
					if (f?.name) folderNameMap.set(id, f.name);
				}
				if (targetFolderId) {
					const t = folders.find((x) => x.id === targetFolderId);
					targetFolderName = t?.name;
					targetFolderPath = t?.path;
				}
			}

			const result = await mediaService.bulkMoveItems(fileIds, folderIds, targetFolderId);

			// Log activity for successfully moved items
			const prettyDest = this.formatPathForDescription(
				targetFolderPath,
				targetFolderName || (targetFolderId ? "Folder" : "Root"),
			);
			for (const fileId of result.movedFiles) {
				const title = fileNameMap.get(fileId) ?? `File ${fileId}`;
				await ActivityService.log({
					userId: req.user!.id,
					action: "update",
					module: "media",
					itemType: "file",
					itemId: fileId,
					itemTitle: title,
					description: `**${title}** file has been moved to **${prettyDest}**`,
				});
			}

			for (const folderId of result.movedFolders) {
				const title = folderNameMap.get(folderId) ?? `Folder ${folderId}`;
				await ActivityService.log({
					userId: req.user!.id,
					action: "update",
					module: "media",
					itemType: "folder",
					itemId: folderId,
					itemTitle: title,
					description: `**${title}** folder has been moved to **${prettyDest}**`,
				});
			}

			res.json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Generate presigned URL for direct S3 upload
	 */
	async getPresignedUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().positive(),
			});

			const { filename, mimeType, size } = schema.parse(req.body);

			// Generate presigned URL
			const { presignedUrl, key, uuid } = await s3Service.generatePresignedUploadUrl(filename, mimeType);

			res.json(
				apiResponse.success({
					presignedUrl,
					key,
					uuid,
				}),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Confirm upload after file is uploaded directly to S3
	 */
	async confirmUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({
				key: z.string().min(1),
				filename: z.string().min(1),
				originalName: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().positive(),
				folderId: z.number().optional(),
			});

			const { key, filename, originalName, mimeType, size, folderId } = schema.parse(req.body);

			// Create the media file record in database
			const result = await mediaService.createFileRecord({
				uuid: key,
				filename,
				originalName,
				mimeType,
				size,
				folderId,
			});

			// Log activity
			await ActivityService.log({
				userId: req.user!.id,
				action: "create",
				module: "media",
				itemType: "file",
				itemId: result.id,
				itemTitle: result.originalName,
				description: `**${result.originalName}** file has been uploaded`,
			});

			res.status(201).json(apiResponse.success(result));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get file usage details
	 */
	async getFileUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);
			if (isNaN(fileId)) {
				res.status(400).json(apiResponse.error("Invalid file ID", "INVALID_ID"));
				return;
			}

			const usage = await mediaService.getFileUsage(fileId);
			res.json(apiResponse.success(usage));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get processing status for multiple video files (batch)
	 */
	async getProcessingStatuses(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const schema = z.object({
				fileIds: z.array(z.number()).min(1).max(50),
			});

			const { fileIds } = schema.parse(req.body);
			const statuses = await mediaService.getProcessingStatuses(fileIds);
			res.json(apiResponse.success(statuses));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Create a default clip for a video file
	 * POST /api/media/files/:id/clips
	 */
	async createDefaultClip(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);

			const schema = z.object({
				cropSettings: z
					.object({
						x: z.number().min(0).max(100),
						y: z.number().min(0).max(100),
						width: z.number().min(0).max(100),
						height: z.number().min(0).max(100),
						aspect: z.number(),
						aspectLabel: z.string().optional(),
					})
					.optional(),
				trimSettings: z
					.object({
						startTime: z.number().min(0),
						endTime: z.number().min(0),
					})
					.optional(),
			});

			const { cropSettings, trimSettings } = schema.parse(req.body);

			// Verify media file exists and is a video
			const mediaFile = await mediaService.getFileById(fileId);
			if (!mediaFile) {
				res.status(404).json(apiResponse.error("Media file not found", "NOT_FOUND"));
				return;
			}
			if (!mediaFile.mimeType.startsWith("video/")) {
				res.status(400).json(apiResponse.error("File is not a video", "INVALID_TYPE"));
				return;
			}

			// Check if clip processing is available
			if (!clipProcessingService.isAvailable()) {
				res.status(503).json(apiResponse.error("Video processing is not configured", "SERVICE_UNAVAILABLE"));
				return;
			}

			// If there's an existing default clip, it will be overridden by the new one
			// First, unset existing default clips for this media
			await clipJobService.unsetDefaultClips(fileId);

			// Create the clip job
			const result = await clipProcessingService.createClipJob({
				contextType: "media_library",
				mediaFileId: fileId,
				cropSettings,
				trimSettings,
				isDefault: true,
			});

			if (!result) {
				res.status(500).json(apiResponse.error("Failed to create clip job", "PROCESSING_ERROR"));
				return;
			}

			// Mark the new clip as default
			await clipJobService.setDefault(result.clipJobId);

			// Fetch the full clip job record
			const clipJob = await clipJobService.getJob(result.clipJobId);
			res.status(201).json(apiResponse.success(enrichClipWithUrls(clipJob)));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get the default clip for a video file
	 * GET /api/media/files/:id/clips/default
	 */
	async getDefaultClip(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);

			const clipJob = await clipJobService.getDefaultClip(fileId);

			if (!clipJob) {
				res.status(404).json(apiResponse.error("No default clip found", "NOT_FOUND"));
				return;
			}

			res.json(apiResponse.success(enrichClipWithUrls(clipJob)));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete the default clip for a video file
	 * DELETE /api/media/files/:id/clips/default
	 */
	async deleteDefaultClip(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const fileId = parseInt(req.params.id as string);

			const clipJob = await clipJobService.getDefaultClip(fileId);
			if (!clipJob) {
				res.status(404).json(apiResponse.error("No default clip found", "NOT_FOUND"));
				return;
			}

			await clipJobService.unsetDefaultClips(fileId);
			res.json(apiResponse.success({ message: "Default clip removed" }));
		} catch (error) {
			next(error);
		}
	}
}

export const mediaController = new MediaController();
