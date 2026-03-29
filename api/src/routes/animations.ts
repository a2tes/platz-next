import { Router } from "express";
import { animationsController } from "../controllers/animationsController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Apply authentication to all animations routes
router.use(authenticateToken);

// Animations reordering (must be before /:id routes)
router.put("/reorder", animationsController.reorderAnimations.bind(animationsController));

// Animations routes (/:id routes must be last)
router.post("/", animationsController.createAnimation.bind(animationsController));
router.get("/", animationsController.getAnimations.bind(animationsController));
router.get("/counts", animationsController.getCounts.bind(animationsController));

// Animations trash management (must be before /:id routes)
router.get("/trash", animationsController.getTrashedAnimations.bind(animationsController));
router.post("/bulk/delete", animationsController.bulkDeleteAnimations.bind(animationsController));
router.post("/bulk/purge", animationsController.bulkPurgeAnimations.bind(animationsController));
router.post("/:id/trash", animationsController.trashAnimation.bind(animationsController));
router.post("/:id/restore", animationsController.restoreAnimation.bind(animationsController));
router.post("/:id/purge", animationsController.purgeAnimation.bind(animationsController));

// Animations status management (must be before /:id routes)
router.post("/bulk/publish", animationsController.bulkPublishAnimations.bind(animationsController));
router.post("/bulk/unpublish", animationsController.bulkUnpublishAnimations.bind(animationsController));
router.patch("/:id/publish", animationsController.publishAnimation.bind(animationsController));
router.patch("/:id/unpublish", animationsController.unpublishAnimation.bind(animationsController));

// Animations revision management (must be before /:id routes)
router.post("/:id/revisions/:revisionId/revert", animationsController.revertToRevision.bind(animationsController));

// Update title only (must be before /:id routes)
router.patch("/:id/title", animationsController.updateAnimationTitle.bind(animationsController));

// ID-based routes (must be last)
router.get("/:id", animationsController.getAnimation.bind(animationsController));
router.put("/:id", animationsController.updateAnimation.bind(animationsController));
router.delete("/:id", animationsController.deleteAnimation.bind(animationsController));

export default router;
