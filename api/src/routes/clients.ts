import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
	getClients,
	searchClients,
	getClientById,
	createClient,
	findOrCreateClient,
	updateClient,
	deleteClient,
	restoreClient,
	purgeClient,
	getTrashedClients,
	getClientsCounts,
	publishClient,
	unpublishClient,
	bulkDeleteClients,
	bulkPurgeClients,
} from "../controllers/clientController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Client routes
router.get("/", getClients);
router.get("/search", searchClients);
router.get("/trash", getTrashedClients);
router.get("/counts", getClientsCounts);
router.post("/", createClient);
router.post("/find-or-create", findOrCreateClient);
router.post("/bulk-delete", bulkDeleteClients);
router.post("/bulk-purge", bulkPurgeClients);
router.get("/:id", getClientById);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.post("/:id/restore", restoreClient);
router.post("/:id/purge", purgeClient);
router.post("/:id/publish", publishClient);
router.post("/:id/unpublish", unpublishClient);

export default router;
