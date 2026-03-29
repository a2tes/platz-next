export interface UploadResult {
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	uuid: string;
	publicUrl: string;
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
	mp4_720p?: string | null; // 720p MP4 URL for homepage
	preview?: string | null; // 480p MP4 URL for fast hover preview
	original?: string; // Original video URL for fallback
	/** @deprecated Use 'provider' instead */
	imgix?: string;
}

export interface MediaUrlSet {
	images: ImageUrlSet;
	video?: VideoUrlSet;
}

export interface StorageProvider {
	uploadFile(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<UploadResult>;

	deleteFile(uuid: string): Promise<void>;

	generateUrlSet(uuid: string, mimeType?: string, thumbnailTime?: number | null): MediaUrlSet;

	getFileBuffer(uuid: string): Promise<Buffer | null>;
}
