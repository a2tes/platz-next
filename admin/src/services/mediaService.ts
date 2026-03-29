import { api } from "../lib/api";

const API_URL =
	`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}` ||
	`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

export interface ExistingClip {
	id: string;
	sourceMediaId: number;
	status: string;
	cropSettings: { x: number; y: number; width: number; height: number; aspect: number; aspectLabel?: string } | null;
	trimSettings: { startTime: number; endTime: number } | null;
	outputUrl: string | null;
	thumbnailUrl: string | null;
	outputMetadata: { width: number; height: number; duration: number; size?: number } | null;
	createdAt: string;
}

export interface ImageUrlSet {
	thumbnail: string;
	small: string;
	medium: string;
	large: string;
	original: string;
	hero?: string;
	gallery?: string;
}

export interface VideoUrlSet {
	default: string; // Primary video URL (HLS if available, otherwise optimized 1080p or original)
	provider: string; // Base provider URL for generating custom thumbnails
	hls?: string | null; // HLS manifest URL for adaptive streaming
	mp4?: string | null; // Optimized 1080p MP4 URL for fallback
	original?: string; // Original video URL for fallback
	/** @deprecated Use 'provider' instead */
	imgix?: string;
}

export interface MediaFile {
	id: number;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	uuid: string;
	images: ImageUrlSet;
	video?: VideoUrlSet; // For video files
	category: "image" | "video" | "document" | "other";
	folderId?: number;
	altText?: string;
	thumbnailTime?: number;
	thumbnailPath?: string; // Path to custom video thumbnail
	usageCount: number;
	hasClips?: boolean;
	createdAt: string;
	updatedAt: string;
	// Video processing status
	processingStatus?: "pending" | "processing" | "completed" | "failed";
	processingError?: string;
	hlsUrl?: string;
	optimizedVideoUrl?: string;
	optimizedUrls?: Record<string, string>; // { "1080p": "url", "720p": "url", ... }
}

export interface Mediable {
	id: number;
	mediaId: number;
	media?: {
		id: number;
		uuid: string;
		filename: string;
		mimeType: string;
		altText?: string;
	};
	subjectType: string;
	subjectId: number;
	usageKey: string;
	// Crop rectangle in pixels (API returns x/y/w/h)
	x: number;
	y: number;
	w: number;
	h: number;
	originalW: number;
	originalH: number;
	createdAt: string;
	updatedAt: string;
}

export interface MediaFolder {
	id: number;
	name: string;
	parentId?: number;
	path: string;
	children?: MediaFolder[];
	fileCount: number;
	subfolderCount: number;
	totalFileCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface MediaUploadResult {
	id: number;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	uuid: string;
	images: MediaFile["images"];
	video?: MediaFile["video"];
	category: MediaFile["category"];
	folderId?: number;
	createdAt: string;
}

export interface PresignedUrlResponse {
	presignedUrl: string;
	key: string;
	uuid: string;
}

export interface UploadProgressCallback {
	(progress: number): void;
}

export interface UploadController {
	abort: () => void;
}

export interface PaginatedResponse<T> {
	success: boolean;
	data: T[];
	meta: {
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
		timestamp: string;
	};
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	meta: {
		timestamp: string;
	};
}

export class MediaService {
	/**
	 * Build a lazy-cropped image URL served by backend
	 * Example: /api/media/crop/:id?subjectType=Work&subjectId=1&usageKey=hero&w=1200&h=630&format=webp&q=82
	 */
	static buildCroppedImageUrl(params: {
		mediaId: number;
		subjectType: string;
		subjectId: number;
		usageKey: string;
		w?: number;
		h?: number;
		format?: "jpeg" | "png" | "webp" | "avif";
		q?: number; // 1..100
		x?: number;
		y?: number;
		cropW?: number;
		cropH?: number;
	}): string {
		const sp = new URLSearchParams();
		sp.set("subjectType", params.subjectType);
		sp.set("subjectId", String(params.subjectId));
		sp.set("usageKey", params.usageKey);
		if (params.w) sp.set("w", String(params.w));
		if (params.h) sp.set("h", String(params.h));
		if (params.format) sp.set("format", params.format);
		if (params.q) sp.set("q", String(params.q));
		if (typeof params.x === "number") sp.set("x", String(params.x));
		if (typeof params.y === "number") sp.set("y", String(params.y));
		if (typeof params.cropW === "number") sp.set("cropW", String(params.cropW));
		if (typeof params.cropH === "number") sp.set("cropH", String(params.cropH));
		return `${API_URL}/api/media/crop/${params.mediaId}?${sp.toString()}`;
	}

	/**
	 * Build a direct image provider URL (supports Imgix and ImageKit)
	 */
	static buildImageUrl(params: {
		uuid: string;
		crop?: { x: number; y: number; w: number; h: number };
		w?: number;
		h?: number;
		q?: number;
		format?: "auto" | "jpeg" | "png" | "webp" | "avif";
	}): string {
		// Try ImageKit first, then Imgix
		const imagekitEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
		const imgixDomain = process.env.NEXT_PUBLIC_IMGIX_URL;

		if (imagekitEndpoint) {
			return MediaService.buildImageKitUrl(params, imagekitEndpoint);
		} else if (imgixDomain) {
			return MediaService.buildImgixUrl(params, imgixDomain);
		}

		throw new Error("No image provider configured (IMAGEKIT_URL_ENDPOINT or IMGIX_URL)");
	}

	/**
	 * Build Imgix URL
	 */
	private static buildImgixUrl(
		params: {
			uuid: string;
			crop?: { x: number; y: number; w: number; h: number };
			w?: number;
			h?: number;
			q?: number;
			format?: "auto" | "jpeg" | "png" | "webp" | "avif";
		},
		domain: string,
	): string {
		const url = new URL(`https://${domain}/${params.uuid}`);

		if (params.crop) {
			url.searchParams.set("rect", `${params.crop.x},${params.crop.y},${params.crop.w},${params.crop.h}`);
		}

		if (params.w) url.searchParams.set("w", String(params.w));
		if (params.h) url.searchParams.set("h", String(params.h));
		if (params.q) url.searchParams.set("q", String(params.q));

		url.searchParams.set("auto", "format,compress");

		if (params.format && params.format !== "auto") {
			url.searchParams.set("fm", params.format);
		}

		return url.toString();
	}

	/**
	 * Build ImageKit URL
	 */
	private static buildImageKitUrl(
		params: {
			uuid: string;
			crop?: { x: number; y: number; w: number; h: number };
			w?: number;
			h?: number;
			q?: number;
			format?: "auto" | "jpeg" | "png" | "webp" | "avif";
		},
		endpoint: string,
	): string {
		const baseUrl = endpoint.replace(/\/$/, "");
		const path = params.uuid.startsWith("/") ? params.uuid : `/${params.uuid}`;

		const transforms: string[] = [];

		if (params.crop) {
			transforms.push(`cm-extract,x-${params.crop.x},y-${params.crop.y},w-${params.crop.w},h-${params.crop.h}`);
		}

		if (params.w) transforms.push(`w-${params.w}`);
		if (params.h) transforms.push(`h-${params.h}`);
		if (params.q) transforms.push(`q-${params.q}`);

		if (params.format && params.format !== "auto") {
			transforms.push(`f-${params.format}`);
		}

		const trString = transforms.join(",");
		return trString ? `${baseUrl}${path}?tr=${trString}` : `${baseUrl}${path}`;
	}

	/**
	 * Get presigned URL for direct S3 upload
	 */
	static async getPresignedUrl(filename: string, mimeType: string, size: number): Promise<PresignedUrlResponse> {
		const response = await api.post<ApiResponse<PresignedUrlResponse>>("/api/media/presign", {
			filename,
			mimeType,
			size,
		});
		return response.data.data;
	}

	/**
	 * Confirm upload after file is uploaded to S3
	 */
	static async confirmUpload(data: {
		key: string;
		filename: string;
		originalName: string;
		mimeType: string;
		size: number;
		folderId?: number;
	}): Promise<MediaUploadResult> {
		const response = await api.post<ApiResponse<MediaUploadResult>>("/api/media/confirm", data);
		return response.data.data;
	}

	/**
	 * Upload file directly to S3 using presigned URL with progress tracking
	 * Returns both a promise and an abort function to cancel the upload
	 */
	static uploadToS3WithProgress(
		presignedUrl: string,
		file: File,
		onProgress?: UploadProgressCallback,
	): { promise: Promise<void>; abort: () => void } {
		const xhr = new XMLHttpRequest();

		const promise = new Promise<void>((resolve, reject) => {
			xhr.upload.addEventListener("progress", (event) => {
				if (event.lengthComputable && onProgress) {
					const percentComplete = Math.round((event.loaded / event.total) * 100);
					onProgress(percentComplete);
				}
			});

			xhr.addEventListener("load", () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve();
				} else {
					reject(new Error(`Upload failed with status ${xhr.status}`));
				}
			});

			xhr.addEventListener("error", () => {
				reject(new Error("Upload failed"));
			});

			xhr.addEventListener("abort", () => {
				reject(new Error("Upload aborted"));
			});

			xhr.open("PUT", presignedUrl);
			xhr.setRequestHeader("Content-Type", file.type);
			xhr.send(file);
		});

		return {
			promise,
			abort: () => xhr.abort(),
		};
	}

	/**
	 * Upload a single file with progress tracking (uses presigned URL for direct S3 upload)
	 * @param file - The file to upload
	 * @param folderId - Optional folder ID to upload to
	 * @param onProgress - Optional callback for upload progress (0-100)
	 * @param onAbortReady - Optional callback that receives the abort function when upload starts
	 */
	static async uploadFile(
		file: File,
		folderId?: number,
		onProgress?: UploadProgressCallback,
		onAbortReady?: (controller: UploadController) => void,
	): Promise<MediaUploadResult> {
		// Step 1: Get presigned URL from API
		const { presignedUrl, key } = await this.getPresignedUrl(file.name, file.type, file.size);

		// Step 2: Upload directly to S3 with progress tracking
		const { promise, abort } = this.uploadToS3WithProgress(presignedUrl, file, onProgress);

		// Notify caller that abort is now available
		if (onAbortReady) {
			onAbortReady({ abort });
		}

		await promise;

		// Step 3: Confirm upload with API to create database record
		const result = await this.confirmUpload({
			key,
			filename: file.name.toLowerCase().replace(/[^a-z0-9.]/g, "-"),
			originalName: file.name,
			mimeType: file.type,
			size: file.size,
			folderId,
		});

		return result;
	}

	/**
	 * Upload a single file (legacy method without progress - kept for compatibility)
	 */
	static async uploadFileLegacy(file: File, folderId?: number): Promise<MediaUploadResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (folderId) {
			formData.append("folderId", folderId.toString());
		}

		const response = await api.post<ApiResponse<MediaUploadResult>>("/api/media/upload", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
			timeout: 1000 * 60 * 30, // 30 minutes
		});

		return response.data.data;
	}

	/**
	 * Upload multiple files
	 */
	static async uploadFiles(
		files: File[],
		folderId?: number,
	): Promise<{
		uploaded: MediaUploadResult[];
		count: number;
	}> {
		const formData = new FormData();
		files.forEach((file) => {
			formData.append("files", file);
		});
		if (folderId) {
			formData.append("folderId", folderId.toString());
		}

		const response = await api.post<
			ApiResponse<{
				uploaded: MediaUploadResult[];
				count: number;
			}>
		>("/api/media/upload/multiple", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
			timeout: 1000 * 60 * 30, // 30 minutes
		});

		return response.data.data;
	}

	/**
	 * Get files in folder with pagination
	 */
	static async getFiles(
		params: {
			folderId?: number;
			page?: number;
			limit?: number;
			search?: string;
			type?: "image" | "video" | "file";
			mimeTypes?: string[];
		} = {},
	): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();

		if (params.folderId) searchParams.append("folderId", params.folderId.toString());
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.type) searchParams.append("type", params.type);
		if (params.mimeTypes) searchParams.append("mimeTypes", params.mimeTypes.join(","));

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/files?${searchParams}`);
		return response.data;
	}

	/**
	 * Get images only
	 */
	static async getImages(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/images?${searchParams}`);
		return response.data;
	}

	/**
	 * Get videos only
	 */
	static async getVideos(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/videos?${searchParams}`);
		return response.data;
	}

	/**
	 * Get documents only (excluding images and videos)
	 */
	static async getDocuments(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/documents?${searchParams}`);
		return response.data;
	}

	/**
	 * Get all files in folders
	 */
	static async getFolderFiles(
		params: {
			folderId?: number;
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();

		if (params.folderId) searchParams.append("folderId", params.folderId.toString());
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/folders/files?${searchParams}`);
		return response.data;
	}

	/**
	 * Get file by ID
	 */
	static async getFile(id: number): Promise<MediaFile> {
		const response = await api.get<ApiResponse<MediaFile>>(`/api/media/files/${id}`);
		return response.data.data;
	}

	/**
	 * Get processing status for multiple video files (batch)
	 * Used for polling to update UI when video processing completes
	 */
	static async getProcessingStatuses(fileIds: number[]): Promise<
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
		const response = await api.post<
			ApiResponse<
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
			>
		>("/api/media/files/processing-status", { fileIds });
		return response.data.data;
	}

	/**
	 * Get file usage details
	 */
	static async getFileUsage(id: number): Promise<any> {
		const response = await api.get<ApiResponse<any>>(`/api/media/files/${id}/usage`);
		return response.data.data;
	}

	/**
	 * Update file metadata
	 */
	static async updateFile(id: number, data: { altText?: string; originalName?: string }): Promise<MediaFile> {
		const response = await api.put<ApiResponse<MediaFile>>(`/api/media/files/${id}`, data);
		return response.data.data;
	}

	/**
	 * Update file metadata (alt text, thumbnail time, etc.)
	 */
	static async updateFileMetadata(
		id: number,
		data: { altText?: string; originalName?: string; thumbnailTime?: number },
	): Promise<ApiResponse<MediaFile>> {
		const response = await api.patch(`/api/media/files/${id}/metadata`, data);
		return response.data;
	}

	/**
	 * Upload a video thumbnail captured from canvas
	 */
	static async uploadVideoThumbnail(
		fileId: number,
		thumbnailBlob: Blob,
		thumbnailTime: number,
	): Promise<ApiResponse<MediaFile>> {
		const formData = new FormData();
		formData.append("thumbnail", thumbnailBlob, "thumbnail.jpg");
		formData.append("thumbnailTime", thumbnailTime.toString());

		const response = await api.post(`/api/media/files/${fileId}/thumbnail`, formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});
		return response.data;
	}

	/**
	 * Create a default clip for a video file
	 */
	static async createDefaultClip(
		fileId: number,
		settings: {
			cropSettings?: {
				x: number;
				y: number;
				width: number;
				height: number;
				aspect: number;
				aspectLabel?: string;
			};
			trimSettings?: {
				startTime: number;
				endTime: number;
			};
		},
	): Promise<any> {
		const response = await api.post(`/api/media/files/${fileId}/clips`, settings);
		return response.data.data;
	}

	/**
	 * Get the default clip for a video file
	 */
	static async getDefaultClip(fileId: number): Promise<any | null> {
		try {
			const response = await api.get(`/api/media/files/${fileId}/clips/default`);
			return response.data.data;
		} catch (error: any) {
			if (error?.response?.status === 404) return null;
			throw error;
		}
	}

	/**
	 * Delete the default clip for a video file
	 */
	static async deleteDefaultClip(fileId: number): Promise<void> {
		await api.delete(`/api/media/files/${fileId}/clips/default`);
	}

	/**
	 * Get all clips with pagination
	 */
	static async getAllClips(
		params: {
			page?: number;
			limit?: number;
			status?: string;
			search?: string;
		} = {},
	): Promise<{
		data: any[];
		meta: { pagination: { page: number; limit: number; total: number; totalPages: number } };
	}> {
		const response = await api.get("/api/clip-jobs/all", { params });
		return response.data;
	}

	/**
	 * Get completed clips for a source media file
	 */
	static async getClipsByMediaId(mediaId: number): Promise<ExistingClip[]> {
		const response = await api.get(`/api/clip-jobs/by-media/${mediaId}`);
		return response.data.data;
	}

	/**
	 * Get clip usage info
	 */
	static async getClipUsage(clipId: string): Promise<{
		homepageDirectors: Array<{
			id: number;
			work: { id: number; title: string } | null;
			director: { id: number; title: string } | null;
		}>;
		directorsPageSelections: Array<{
			id: number;
			work: { id: number; title: string } | null;
			director: { id: number; title: string } | null;
		}>;
		blocks: Array<{ id: number; modelName: string; modelId: number | null; modelTitle: string | null }>;
	}> {
		const response = await api.get(`/api/clip-jobs/${clipId}/usage`);
		return response.data.data;
	}

	/**
	 * Delete a clip job (only if not in use)
	 */
	static async deleteClip(clipId: string): Promise<void> {
		await api.delete(`/api/clip-jobs/${clipId}`);
	}

	/**
	 * Retry a failed clip job
	 */
	static async retryClip(clipId: string): Promise<ExistingClip> {
		const response = await api.post(`/api/clip-jobs/${clipId}/retry`);
		return response.data.data;
	}

	/**
	 * Delete file
	 */
	static async deleteFile(id: number): Promise<void> {
		await api.delete(`/api/media/files/${id}`);
	}

	/**
	 * Delete multiple files
	 */
	static async deleteFiles(fileIds: number[]): Promise<{
		deleted: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const response = await api.delete<
			ApiResponse<{
				deleted: number[];
				failed: Array<{ id: number; error: string }>;
			}>
		>("/api/media/files", {
			data: { fileIds },
		});

		return response.data.data;
	}

	/**
	 * Move file to folder
	 */
	static async moveFile(fileId: number, folderId?: number): Promise<MediaFile> {
		const response = await api.put<ApiResponse<MediaFile>>(`/api/media/files/${fileId}/move`, {
			folderId,
		});

		return response.data.data;
	}

	/**
	 * Move multiple files to folder
	 */
	static async moveFiles(
		fileIds: number[],
		folderId?: number,
	): Promise<{
		moved: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const response = await api.put<
			ApiResponse<{
				moved: number[];
				failed: Array<{ id: number; error: string }>;
			}>
		>("/api/media/files/move", {
			fileIds,
			folderId,
		});

		return response.data.data;
	}

	/**
	 * Get folder tree with trash count
	 */
	static async getFolders(): Promise<ApiResponse<{ folders: MediaFolder[]; trashCount: number }>> {
		const response = await api.get<ApiResponse<{ folders: MediaFolder[]; trashCount: number }>>("/api/media/folders");
		return response.data;
	}

	/**
	 * Create folder
	 */
	static async createFolder(name: string, parentId?: number): Promise<MediaFolder> {
		const response = await api.post<ApiResponse<MediaFolder>>("/api/media/folders", {
			name,
			parentId,
		});

		return response.data.data;
	}

	/**
	 * Delete folder
	 */
	static async deleteFolder(id: number): Promise<void> {
		await api.delete(`/api/media/folders/${id}`);
	}

	/**
	 * Rename folder
	 */
	static async renameFolder(id: number, name: string): Promise<MediaFolder> {
		const response = await api.put<ApiResponse<MediaFolder>>(`/api/media/folders/${id}/rename`, {
			name,
		});

		return response.data.data;
	}

	/**
	 * Search media files
	 */
	static async searchMedia(params: {
		q: string;
		type?: "image" | "video" | "document" | "all";
		page?: number;
		limit?: number;
	}): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();
		searchParams.append("q", params.q);
		if (params.type) searchParams.append("type", params.type);
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/search?${searchParams}`);
		return response.data;
	}

	/**
	 * Get media statistics
	 */
	static async getStats(): Promise<{
		totalFiles: number;
		totalSize: number;
		filesByType: Record<string, number>;
		recentUploads: number;
	}> {
		const response = await api.get<
			ApiResponse<{
				totalFiles: number;
				totalSize: number;
				filesByType: Record<string, number>;
				recentUploads: number;
			}>
		>("/api/media/stats");

		return response.data.data;
	}

	/**
	 * Bulk delete items (files and folders)
	 */
	static async bulkDeleteItems(params: { fileIds?: number[]; folderIds?: number[] }): Promise<{
		deletedFiles: number[];
		deletedFolders: number[];
		failed: Array<{ id: number; type: "file" | "folder"; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				deletedFiles: number[];
				deletedFolders: number[];
				failed: Array<{ id: number; type: "file" | "folder"; error: string }>;
			}>
		>("/api/media/items/delete", {
			fileIds: params.fileIds || [],
			folderIds: params.folderIds || [],
		});

		return response.data.data;
	}

	/**
	 * Bulk move items (files and folders)
	 */
	static async bulkMoveItems(params: { fileIds?: number[]; folderIds?: number[]; targetFolderId?: number }): Promise<{
		movedFiles: number[];
		movedFolders: number[];
		failed: Array<{ id: number; type: "file" | "folder"; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				movedFiles: number[];
				movedFolders: number[];
				failed: Array<{ id: number; type: "file" | "folder"; error: string }>;
			}>
		>("/api/media/items/move", {
			fileIds: params.fileIds || [],
			folderIds: params.folderIds || [],
			targetFolderId: params.targetFolderId,
		});

		return response.data.data;
	}

	/**
	 * Get trashed files
	 */
	static async getTrashedFiles(
		params: { page?: number; limit?: number; search?: string } = {},
	): Promise<PaginatedResponse<MediaFile>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<MediaFile>>(`/api/media/trash/files?${searchParams}`);

		return response.data;
	}

	/**
	 * Restore a file from trash
	 */
	static async restoreFile(id: number): Promise<MediaFile> {
		const response = await api.post<ApiResponse<MediaFile>>(`/api/media/files/${id}/restore`);

		return response.data.data;
	}

	/**
	 * Permanently purge a file from trash
	 */
	static async purgeFile(id: number): Promise<void> {
		await api.post(`/api/media/files/${id}/purge`);
	}

	/**
	 * Bulk restore files from trash
	 */
	static async bulkRestoreFiles(fileIds: number[]): Promise<{
		restored: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				restored: number[];
				failed: Array<{ id: number; error: string }>;
			}>
		>(`/api/media/files/bulk-restore`, { fileIds });

		return response.data.data;
	}

	/**
	 * Bulk purge files (permanently delete from storage)
	 */
	static async bulkPurgeFiles(fileIds: number[]): Promise<{
		purged: number[];
		failed: Array<{ id: number; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				purged: number[];
				failed: Array<{ id: number; error: string }>;
			}>
		>(`/api/media/files/bulk-purge`, { fileIds });

		return response.data.data;
	}

	/**
	 * Get trashed folders
	 */
	static async getTrashedFolders(): Promise<MediaFolder[]> {
		const response = await api.get<ApiResponse<MediaFolder[]>>(`/api/media/trash/folders`);

		return response.data.data;
	}

	/**
	 * Restore a folder from trash
	 */
	static async restoreFolder(id: number): Promise<MediaFolder> {
		const response = await api.post<ApiResponse<MediaFolder>>(`/api/media/folders/${id}/restore`);

		return response.data.data;
	}

	/**
	 * Permanently purge a folder from trash
	 */
	static async purgeFolder(id: number): Promise<void> {
		await api.post(`/api/media/folders/${id}/purge`);
	}

	/**
	 * Format file size for display
	 */
	static formatFileSize(bytes: number): string {
		if (bytes === 0) return "0 Bytes";

		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}

	/**
	 * Upsert a crop configuration for a media usage
	 */
	static async upsertCrop(data: {
		mediaId: number;
		subjectType: string;
		subjectId: number;
		usageKey: string;
		x: number; // px
		y: number; // px
		w: number; // px
		h: number; // px
		originalW?: number;
		originalH?: number;
	}): Promise<Mediable> {
		const res = await api.post<{ success: boolean; data: Mediable }>("/api/media/crops", data);
		return res.data.data;
	}

	/**
	 * Get a crop configuration for a media usage
	 */
	static async getCrop(params: {
		mediaId: number;
		subjectType: string;
		subjectId: number;
		usageKey: string;
	}): Promise<Mediable | null> {
		const sp = new URLSearchParams();
		sp.set("mediaId", String(params.mediaId));
		sp.set("subjectType", params.subjectType);
		sp.set("subjectId", String(params.subjectId));
		sp.set("usageKey", params.usageKey);
		const res = await api.get<{ success: boolean; data: Mediable }>(`/api/media/crops?${sp.toString()}`);
		return res.data.data;
	}

	/**
	 * Resolve a crop configuration by subject only (no mediaId required)
	 */
	static async getCropBySubject(params: {
		subjectType: string;
		subjectId: number;
		usageKey: string;
	}): Promise<Mediable | null> {
		const sp = new URLSearchParams();
		sp.set("subjectType", params.subjectType);
		sp.set("subjectId", String(params.subjectId));
		sp.set("usageKey", params.usageKey);
		const res = await api.get<{ success: boolean; data: Mediable }>(`/api/media/crops/resolve?${sp.toString()}`);
		return res.data.data;
	}

	/**
	 * Delete a crop configuration for a media usage
	 */
	static async deleteCrop(params: {
		mediaId: number;
		subjectType: string;
		subjectId: number;
		usageKey: string;
	}): Promise<{ count: number }> {
		const sp = new URLSearchParams();
		sp.set("mediaId", String(params.mediaId));
		sp.set("subjectType", params.subjectType);
		sp.set("subjectId", String(params.subjectId));
		sp.set("usageKey", params.usageKey);
		const res = await api.delete<{ success: boolean; data: { count: number } }>(`/api/media/crops?${sp.toString()}`);
		return res.data.data;
	}
}
