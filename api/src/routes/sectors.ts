import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
	getSectors,
	searchSectors,
	getSectorById,
	createSector,
	findOrCreateSector,
	updateSector,
	deleteSector,
	restoreSector,
	purgeSector,
	getTrashedSectors,
	getSectorsCounts,
	publishSector,
	unpublishSector,
	bulkDeleteSectors,
	bulkPurgeSectors,
} from "../controllers/sectorController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Sector routes
router.get("/", getSectors);
router.get("/search", searchSectors);
router.get("/trash", getTrashedSectors);
router.get("/counts", getSectorsCounts);
router.post("/", createSector);
router.post("/find-or-create", findOrCreateSector);
router.post("/bulk-delete", bulkDeleteSectors);
router.post("/bulk-purge", bulkPurgeSectors);
router.get("/:id", getSectorById);
router.put("/:id", updateSector);
router.delete("/:id", deleteSector);
router.post("/:id/restore", restoreSector);
router.post("/:id/purge", purgeSector);
router.post("/:id/publish", publishSector);
router.post("/:id/unpublish", unpublishSector);

export default router;
