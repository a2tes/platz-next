import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { contentPagesController } from "../controllers/contentPagesController";

const router = Router();

// Authenticated routes for content pages
router.use(authenticateToken);

// About page endpoints
router.get(
	"/about",
	contentPagesController.getAbout.bind(contentPagesController)
);
router.put(
	"/about",
	contentPagesController.updateAbout.bind(contentPagesController)
);

// Contact page endpoints
router.get(
	"/contact",
	contentPagesController.getContact.bind(contentPagesController)
);
router.put(
	"/contact",
	contentPagesController.updateContact.bind(contentPagesController)
);

// Legal pages endpoints (plural)
// Paginated list and counts
router.get(
	"/legal",
	contentPagesController.getLegalPaginated.bind(contentPagesController)
);
router.get(
	"/legal/counts",
	contentPagesController.getLegalCounts.bind(contentPagesController)
);
router.get(
	"/legal/trashed",
	contentPagesController.getLegalTrashedPaginated.bind(contentPagesController)
);
router.post(
	"/legal",
	contentPagesController.createLegal.bind(contentPagesController)
);
router.get(
	"/legal/:id",
	contentPagesController.getLegalById.bind(contentPagesController)
);
router.put(
	"/legal/:id",
	contentPagesController.updateLegalById.bind(contentPagesController)
);
router.patch(
	"/legal/:id/publish",
	contentPagesController.publishLegalById.bind(contentPagesController)
);
router.patch(
	"/legal/:id/unpublish",
	contentPagesController.unpublishLegalById.bind(contentPagesController)
);
router.delete(
	"/legal/:id",
	contentPagesController.deleteLegalById.bind(contentPagesController)
);
router.patch(
	"/legal/:id/restore",
	contentPagesController.restoreLegalById.bind(contentPagesController)
);
router.delete(
	"/legal/:id/purge",
	contentPagesController.purgeLegalById.bind(contentPagesController)
);

// Bulk operation routes for legal pages
router.post(
	"/legal/bulk/publish",
	contentPagesController.bulkPublishLegal.bind(contentPagesController)
);
router.post(
	"/legal/bulk/unpublish",
	contentPagesController.bulkUnpublishLegal.bind(contentPagesController)
);
router.post(
	"/legal/bulk/delete",
	contentPagesController.bulkDeleteLegal.bind(contentPagesController)
);
router.post(
	"/legal/bulk/restore",
	contentPagesController.bulkRestoreLegal.bind(contentPagesController)
);
router.post(
	"/legal/bulk/purge",
	contentPagesController.bulkPurgeLegal.bind(contentPagesController)
);

export default router;
