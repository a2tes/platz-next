import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { FileValidator } from "../utils/fileValidation";
import { S3_CONFIG } from "../config/aws";

// Configure multer for memory storage (we'll upload directly to S3)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
	// Validate file type
	const typeValidation = FileValidator.validateFileType(file.mimetype);
	if (!typeValidation.isValid) {
		return cb(new Error(typeValidation.error));
	}

	// Validate file name
	const nameValidation = FileValidator.validateFileName(file.originalname);
	if (!nameValidation.isValid) {
		return cb(new Error(nameValidation.error));
	}

	cb(null, true);
};

// Create multer instance
const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: S3_CONFIG.maxFileSize,
		files: 200, // Maximum 200 files per request
	},
});

// Error handling middleware for multer
export const handleMulterError = (error: any, req: Request, res: Response, next: NextFunction) => {
	if (error instanceof multer.MulterError) {
		switch (error.code) {
			case "LIMIT_FILE_SIZE":
				return res.status(400).json({
					success: false,
					error: {
						code: "FILE_TOO_LARGE",
						message: `File size exceeds maximum allowed size of ${FileValidator.formatFileSize(S3_CONFIG.maxFileSize)}`,
						timestamp: new Date().toISOString(),
					},
				});
			case "LIMIT_FILE_COUNT":
				return res.status(400).json({
					success: false,
					error: {
						code: "TOO_MANY_FILES",
						message: "Too many files uploaded. Maximum 20 files allowed per request.",
						timestamp: new Date().toISOString(),
					},
				});
			case "LIMIT_UNEXPECTED_FILE":
				return res.status(400).json({
					success: false,
					error: {
						code: "UNEXPECTED_FILE",
						message: "Unexpected file field in upload request.",
						timestamp: new Date().toISOString(),
					},
				});
			default:
				return res.status(400).json({
					success: false,
					error: {
						code: "UPLOAD_ERROR",
						message: error.message || "File upload error occurred.",
						timestamp: new Date().toISOString(),
					},
				});
		}
	}

	// Handle custom file validation errors
	if (error.message && error.message.includes("not allowed")) {
		return res.status(400).json({
			success: false,
			error: {
				code: "INVALID_FILE_TYPE",
				message: error.message,
				timestamp: new Date().toISOString(),
			},
		});
	}

	// Pass other errors to global error handler
	next(error);
};

// Export upload middleware configurations
export const uploadSingle = upload.single("file");
export const uploadMultiple = upload.array("files", 20);
export const uploadFields = upload.fields([
	{ name: "files", maxCount: 20 },
	{ name: "thumbnails", maxCount: 20 },
]);

// Thumbnail upload - only accepts images, smaller size limit
const thumbnailUpload = multer({
	storage,
	fileFilter: (req, file, cb) => {
		if (!file.mimetype.startsWith("image/")) {
			return cb(new Error("Only image files are allowed for thumbnails"));
		}
		cb(null, true);
	},
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max for thumbnails
		files: 1,
	},
});
export const uploadThumbnail = thumbnailUpload.single("thumbnail");

// Custom upload middleware with enhanced error handling
export const createUploadMiddleware = (fieldName: string, maxCount?: number) => {
	const uploadHandler = maxCount ? upload.array(fieldName, maxCount) : upload.single(fieldName);

	return (req: Request, res: Response, next: NextFunction) => {
		uploadHandler(req, res, (error) => {
			if (error) {
				return handleMulterError(error, req, res, next);
			}
			next();
		});
	};
};

// Middleware to validate uploaded files after multer processing
export const validateUploadedFiles = (req: Request, res: Response, next: NextFunction) => {
	try {
		const files = req.files as Express.Multer.File[] | undefined;
		const file = req.file as Express.Multer.File | undefined;

		// Check if files were uploaded
		if (!files && !file) {
			return res.status(400).json({
				success: false,
				error: {
					code: "NO_FILES_UPLOADED",
					message: "No files were uploaded.",
					timestamp: new Date().toISOString(),
				},
			});
		}

		// Prepare files for validation
		const filesToValidate = files || (file ? [file] : []);
		const fileInfos = filesToValidate.map((f) => ({
			originalName: f.originalname,
			mimeType: f.mimetype,
			size: f.size,
			buffer: f.buffer,
		}));

		// Validate files
		const validation = FileValidator.validateFiles(fileInfos);
		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				error: {
					code: "FILE_VALIDATION_ERROR",
					message: validation.error,
					timestamp: new Date().toISOString(),
				},
			});
		}

		next();
	} catch (error) {
		next(error);
	}
};
