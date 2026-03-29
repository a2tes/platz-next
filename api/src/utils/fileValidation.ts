import { S3_CONFIG } from "../config/aws";

export interface FileValidationResult {
	isValid: boolean;
	error?: string;
}

export interface FileInfo {
	originalName: string;
	mimeType: string;
	size: number;
	buffer?: Buffer;
}

export class FileValidator {
	/**
	 * Validate file type
	 */
	static validateFileType(mimeType: string): FileValidationResult {
		if (!S3_CONFIG.allowedMimeTypes.includes(mimeType)) {
			return {
				isValid: false,
				error: `File type ${mimeType} is not allowed. Allowed types: ${S3_CONFIG.allowedMimeTypes.join(
					", "
				)}`,
			};
		}
		return { isValid: true };
	}

	/**
	 * Validate file size
	 */
	static validateFileSize(size: number): FileValidationResult {
		if (size > S3_CONFIG.maxFileSize) {
			return {
				isValid: false,
				error: `File size ${this.formatFileSize(
					size
				)} exceeds maximum allowed size of ${this.formatFileSize(
					S3_CONFIG.maxFileSize
				)}`,
			};
		}
		return { isValid: true };
	}

	/**
	 * Validate file name
	 */
	static validateFileName(fileName: string): FileValidationResult {
		// Check for empty filename
		if (!fileName || fileName.trim().length === 0) {
			return {
				isValid: false,
				error: "File name cannot be empty",
			};
		}

		// Check filename length
		if (fileName.length > 191) {
			return {
				isValid: false,
				error: "File name is too long (maximum 191 characters)",
			};
		}

		// Check for invalid characters
		const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
		if (invalidChars.test(fileName)) {
			return {
				isValid: false,
				error: "File name contains invalid characters",
			};
		}

		return { isValid: true };
	}

	/**
	 * Comprehensive file validation
	 */
	static validateFile(file: FileInfo): FileValidationResult {
		// Validate file name
		const nameValidation = this.validateFileName(file.originalName);
		if (!nameValidation.isValid) {
			return nameValidation;
		}

		// Validate file type
		const typeValidation = this.validateFileType(file.mimeType);
		if (!typeValidation.isValid) {
			return typeValidation;
		}

		// Validate file size
		const sizeValidation = this.validateFileSize(file.size);
		if (!sizeValidation.isValid) {
			return sizeValidation;
		}

		return { isValid: true };
	}

	/**
	 * Validate multiple files
	 */
	static validateFiles(files: FileInfo[]): FileValidationResult {
		if (files.length === 0) {
			return {
				isValid: false,
				error: "No files provided",
			};
		}

		// Check total size
		const totalSize = files.reduce((sum, file) => sum + file.size, 0);
		const maxTotalSize = S3_CONFIG.maxFileSize * 10; // Allow up to 10x single file limit for bulk uploads

		if (totalSize > maxTotalSize) {
			return {
				isValid: false,
				error: `Total file size ${this.formatFileSize(
					totalSize
				)} exceeds maximum allowed total size of ${this.formatFileSize(
					maxTotalSize
				)}`,
			};
		}

		// Validate each file
		for (let i = 0; i < files.length; i++) {
			const fileValidation = this.validateFile(files[i]);
			if (!fileValidation.isValid) {
				return {
					isValid: false,
					error: `File ${i + 1} (${files[i].originalName}): ${
						fileValidation.error
					}`,
				};
			}
		}

		return { isValid: true };
	}

	/**
	 * Check if file is an image
	 */
	static isImage(mimeType: string): boolean {
		return mimeType.startsWith("image/");
	}

	/**
	 * Check if file is a video
	 */
	static isVideo(mimeType: string): boolean {
		return mimeType.startsWith("video/");
	}

	/**
	 * Check if file is a document
	 */
	static isDocument(mimeType: string): boolean {
		return mimeType.startsWith("application/");
	}

	/**
	 * Get file category based on mime type
	 */
	static getFileCategory(
		mimeType: string
	): "image" | "video" | "document" | "other" {
		if (this.isImage(mimeType)) return "image";
		if (this.isVideo(mimeType)) return "video";
		if (this.isDocument(mimeType)) return "document";
		return "other";
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
	 * Generate safe filename
	 */
	static generateSafeFileName(originalName: string): string {
		// Remove invalid characters and replace with underscores
		const safeName = originalName
			.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
			.replace(/\s+/g, "_")
			.toLowerCase();

		// Ensure filename is not too long
		if (safeName.length > 200) {
			const extension = safeName.substring(safeName.lastIndexOf("."));
			const nameWithoutExt = safeName.substring(0, safeName.lastIndexOf("."));
			return nameWithoutExt.substring(0, 200 - extension.length) + extension;
		}

		return safeName;
	}
}
