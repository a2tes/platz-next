import { Router } from "express";
import { worksController } from "../controllers/worksController";
import { directorsController } from "../controllers/directorsController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Apply authentication to all works routes
router.use(authenticateToken);

// Works reordering (must be before /:id routes)
router.put("/reorder", worksController.reorderWorks.bind(worksController));

// Directors routes (must be before /:id routes)
router.post("/directors", directorsController.createDirector.bind(directorsController));
router.get("/directors", directorsController.getDirectors.bind(directorsController));
router.post("/directors/bulk/delete", directorsController.bulkDeleteDirectors.bind(directorsController));
router.post("/directors/bulk/purge", directorsController.bulkPurgeDirectors.bind(directorsController));
router.get("/directors/counts", directorsController.getCounts.bind(directorsController));
router.get("/directors/trash", directorsController.getTrashedDirectors.bind(directorsController));
// Director works management (must be before /directors/:id route)
router.get("/directors/:id/works", directorsController.getDirectorWorks.bind(directorsController));
router.get("/directors/:id/works/paginated", directorsController.getDirectorWorksPaginated.bind(directorsController));
router.put("/directors/:id/works/reorder", directorsController.reorderDirectorWorks.bind(directorsController));
// Director hero video management
router.put("/directors/:id/hero-video", directorsController.setHeroVideo.bind(directorsController));
router.post("/directors/:id/hero-video/process", directorsController.processHeroVideo.bind(directorsController));
router.delete("/directors/:id/hero-video", directorsController.removeHeroVideo.bind(directorsController));
router.get("/directors/:id", directorsController.getDirector.bind(directorsController));
router.put("/directors/:id", directorsController.updateDirector.bind(directorsController));
router.delete("/directors/:id", directorsController.deleteDirector.bind(directorsController));
router.post("/directors/:id/trash", directorsController.trashDirector.bind(directorsController));
router.post("/directors/:id/restore", directorsController.restoreDirector.bind(directorsController));
router.post("/directors/:id/purge", directorsController.purgeDirector.bind(directorsController));
router.patch("/directors/:id/publish", directorsController.publishDirector.bind(directorsController));
router.patch("/directors/:id/unpublish", directorsController.unpublishDirector.bind(directorsController));

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
