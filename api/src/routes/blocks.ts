import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
	getBlocks,
	getBlockById,
	createBlock,
	updateBlock,
	deleteBlock,
	reorderBlocks,
	assignBlocks,
	publishBlocks,
	getBlockPages,
	getBlockPageByType,
	updateBlockPage,
	processVideo,
	getBlockEventsSSE,
} from "../controllers/blockController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Block page routes (must be before /:id to avoid matching "pages" as an id)
router.get("/pages", getBlockPages);
router.get("/pages/:type", getBlockPageByType);
router.put("/pages/:id", updateBlockPage);

// Block routes
router.get("/", getBlocks);
router.post("/", createBlock);
router.put("/reorder", reorderBlocks);
router.put("/assign", assignBlocks);
router.put("/publish", publishBlocks);
router.get("/:id", getBlockById);
router.put("/:id", updateBlock);
router.delete("/:id", deleteBlock);
router.post("/:id/process-video", processVideo);

// SSE endpoint for real-time clip processing updates
router.get("/:id/events", getBlockEventsSSE);

export default router;
