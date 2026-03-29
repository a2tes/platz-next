import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
	getAgencies,
	searchAgencies,
	getAgencyById,
	createAgency,
	findOrCreateAgency,
	updateAgency,
	deleteAgency,
	restoreAgency,
	purgeAgency,
	getTrashedAgencies,
	getAgenciesCounts,
	publishAgency,
	unpublishAgency,
	bulkDeleteAgencies,
	bulkPurgeAgencies,
} from "../controllers/agencyController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Agency routes
router.get("/", getAgencies);
router.get("/search", searchAgencies);
router.get("/trash", getTrashedAgencies);
router.get("/counts", getAgenciesCounts);
router.post("/", createAgency);
router.post("/find-or-create", findOrCreateAgency);
router.post("/bulk-delete", bulkDeleteAgencies);
router.post("/bulk-purge", bulkPurgeAgencies);
router.get("/:id", getAgencyById);
router.put("/:id", updateAgency);
router.delete("/:id", deleteAgency);
router.post("/:id/restore", restoreAgency);
router.post("/:id/purge", purgeAgency);
router.post("/:id/publish", publishAgency);
router.post("/:id/unpublish", unpublishAgency);

export default router;
