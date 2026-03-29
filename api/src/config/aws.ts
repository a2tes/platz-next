import AWS from "aws-sdk";
import { config } from "dotenv";

config();

// Configure AWS SDK
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION || "us-east-1",
});

// Create S3 instance
export const s3 = new AWS.S3({
	apiVersion: "2006-03-01",
	signatureVersion: "v4",
});

// S3 configuration constants
export const S3_CONFIG = {
	bucket: process.env.AWS_S3_BUCKET || "",
	region: process.env.AWS_REGION || "us-east-1",
	maxFileSize: 500 * 1024 * 1024, // 500MB
	allowedMimeTypes: [
		// Images
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/svg+xml",
		// Videos
		"video/mp4",
		"video/mpeg",
		"video/quicktime",
		"video/x-msvideo",
		"video/webm",
		// Documents
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	],
};
