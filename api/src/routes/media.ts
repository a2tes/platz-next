import { Router } from "express";
import { mediaController } from "../controllers/mediaController";
import { mediablesController } from "../controllers/mediablesController";
import { authenticateToken } from "../middleware/auth";
import {
	uploadSingle,
	uploadMultiple,
	handleMulterError,
	validateUploadedFiles,
	uploadThumbnail,
} from "../middleware/upload";

const router = Router();

// Public image proxy for cropped images (no auth)
router.get("/crop/:id", mediablesController.cropImagePublic.bind(mediablesController));

// Apply authentication to all media routes
router.use(authenticateToken);

// Presigned URL upload routes (for direct S3 upload with progress tracking)
router.post("/presign", mediaController.getPresignedUploadUrl.bind(mediaController));
router.post("/confirm", mediaController.confirmUpload.bind(mediaController));

// File upload routes
router.post(
	"/upload",
	uploadSingle,
	handleMulterError,
	validateUploadedFiles,
	mediaController.uploadFile.bind(mediaController),
);

router.post(
	"/upload/multiple",
	uploadMultiple,
	handleMulterError,
	validateUploadedFiles,
	mediaController.uploadFiles.bind(mediaController),
);

// Mediables (crop configurations)
router.post("/crops", mediablesController.upsert.bind(mediablesController));
router.get("/crops", mediablesController.getOne.bind(mediablesController));
router.get("/crops/resolve", mediablesController.resolveBySubject.bind(mediablesController));

// File management routes
router.get("/files", mediaController.getFiles.bind(mediaController));
router.get("/files/:id", mediaController.getFile.bind(mediaController));
router.get("/files/:id/usage", mediaController.getFileUsage.bind(mediaController));
router.put("/files/:id", mediaController.updateFile.bind(mediaController));
router.patch("/files/:id/metadata", mediaController.updateFileMetadata.bind(mediaController));
router.post(
	"/files/:id/thumbnail",
	uploadThumbnail,
	handleMulterError,
	mediaController.uploadVideoThumbnail.bind(mediaController),
);

// Clip management routes
router.post("/files/:id/clips", mediaController.createDefaultClip.bind(mediaController));
router.get("/files/:id/clips/default", mediaController.getDefaultClip.bind(mediaController));
router.delete("/files/:id/clips/default", mediaController.deleteDefaultClip.bind(mediaController));

// Type-specific file routes
router.get("/images", mediaController.getImages.bind(mediaController));
router.get("/videos", mediaController.getVideos.bind(mediaController));
router.get("/documents", mediaController.getDocuments.bind(mediaController));

// Video processing status (batch)
router.post("/files/processing-status", mediaController.getProcessingStatuses.bind(mediaController));

router.delete("/files/:id", mediaController.deleteFile.bind(mediaController));
router.delete("/files", mediaController.deleteFiles.bind(mediaController));
router.put("/files/:id/move", mediaController.moveFile.bind(mediaController));
router.put("/files/move", mediaController.moveFiles.bind(mediaController));

// Trash management
router.get("/trash/files", mediaController.getTrashedFiles.bind(mediaController));
router.get("/trash/folders", mediaController.getTrashedFolders.bind(mediaController));
router.post("/files/:id/restore", mediaController.restoreFile.bind(mediaController));
router.post("/files/:id/purge", mediaController.purgeFile.bind(mediaController));
router.post("/files/bulk-restore", mediaController.bulkRestoreFiles.bind(mediaController));
router.post("/files/bulk-purge", mediaController.bulkPurgeFiles.bind(mediaController));
router.post("/folders/:id/restore", mediaController.restoreFolder.bind(mediaController));
router.post("/folders/:id/purge", mediaController.purgeFolder.bind(mediaController));

// Folder management routes
router.get("/folders", mediaController.getFolderTree.bind(mediaController));
router.get("/folders/files", mediaController.getFolderFiles.bind(mediaController));
router.post("/folders", mediaController.createFolder.bind(mediaController));
router.delete("/folders/:id", mediaController.deleteFolder.bind(mediaController));
router.put("/folders/:id/rename", mediaController.renameFolder.bind(mediaController));

// Search and statistics routes
router.get("/search", mediaController.searchMedia.bind(mediaController));
router.get("/stats", mediaController.getMediaStats.bind(mediaController));
router.delete("/crops", mediablesController.deleteOne.bind(mediablesController));

// Bulk operations routes
router.post("/items/delete", mediaController.bulkDeleteItems.bind(mediaController));
router.post("/items/move", mediaController.bulkMoveItems.bind(mediaController));

export default router;
