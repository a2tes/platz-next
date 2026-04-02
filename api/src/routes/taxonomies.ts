import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
	getTaxonomies,
	searchTaxonomies,
	getTaxonomyById,
	createTaxonomy,
	findOrCreateTaxonomy,
	updateTaxonomy,
	deleteTaxonomy,
	restoreTaxonomy,
	purgeTaxonomy,
	getTrashedTaxonomies,
	getTaxonomyCounts,
	publishTaxonomy,
	unpublishTaxonomy,
	bulkDeleteTaxonomies,
	bulkPurgeTaxonomies,
	reorderTaxonomies,
} from "../controllers/taxonomyController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Taxonomy routes (type is a URL param: clients, sectors, disciplines)
router.get("/:type", getTaxonomies);
router.get("/:type/search", searchTaxonomies);
router.get("/:type/trash", getTrashedTaxonomies);
router.get("/:type/counts", getTaxonomyCounts);
router.post("/:type", createTaxonomy);
router.post("/:type/find-or-create", findOrCreateTaxonomy);
router.post("/:type/bulk-delete", bulkDeleteTaxonomies);
router.post("/:type/bulk-purge", bulkPurgeTaxonomies);
router.post("/:type/reorder", reorderTaxonomies);
router.get("/:type/:id", getTaxonomyById);
router.put("/:type/:id", updateTaxonomy);
router.delete("/:type/:id", deleteTaxonomy);
router.post("/:type/:id/restore", restoreTaxonomy);
router.post("/:type/:id/purge", purgeTaxonomy);
router.post("/:type/:id/publish", publishTaxonomy);
router.post("/:type/:id/unpublish", unpublishTaxonomy);

export default router;
