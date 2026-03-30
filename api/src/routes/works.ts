import { Router } from "express";
import { worksController } from "../controllers/worksController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Apply authentication to all works routes
router.use(authenticateToken);

// Works reordering (must be before /:id routes)
router.put("/reorder", worksController.reorderWorks.bind(worksController));

// Works routes (/:id routes must be last)
router.post("/", worksController.createWork.bind(worksController));
router.get("/", worksController.getWorks.bind(worksController));
router.get("/counts", worksController.getCounts.bind(worksController));

// Works trash management (must be before /:id routes)
router.get("/trash", worksController.getTrashedWorks.bind(worksController));
router.post("/bulk/delete", worksController.bulkDeleteWorks.bind(worksController));
router.post("/bulk/purge", worksController.bulkPurgeWorks.bind(worksController));
router.post("/:id/trash", worksController.trashWork.bind(worksController));
router.post("/:id/restore", worksController.restoreWork.bind(worksController));
router.post("/:id/purge", worksController.purgeWork.bind(worksController));

// Works status management (must be before /:id routes)
router.post("/bulk/publish", worksController.bulkPublishWorks.bind(worksController));
router.post("/bulk/unpublish", worksController.bulkUnpublishWorks.bind(worksController));
router.patch("/:id/publish", worksController.publishWork.bind(worksController));
router.patch("/:id/unpublish", worksController.unpublishWork.bind(worksController));

// Works revision management (must be before /:id routes)
router.post("/:id/revisions/:revisionId/revert", worksController.revertToRevision.bind(worksController));

// Update title only (must be before /:id routes)
router.patch("/:id/title", worksController.updateWorkTitle.bind(worksController));

// ID-based routes (must be last)
router.get("/:id", worksController.getWork.bind(worksController));
router.put("/:id", worksController.updateWork.bind(worksController));
router.delete("/:id", worksController.deleteWork.bind(worksController));

export default router;
