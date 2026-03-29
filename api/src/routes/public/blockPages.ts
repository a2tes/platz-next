import { Router } from "express";
import { getPublicPageBlocks } from "../../controllers/blockController";

const router = Router();

// Public block page routes (no auth)
router.get("/:type/blocks", getPublicPageBlocks);

export default router;
