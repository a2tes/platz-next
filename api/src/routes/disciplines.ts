import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
	getDisciplines,
	searchDisciplines,
	getDisciplineById,
	createDiscipline,
	findOrCreateDiscipline,
	updateDiscipline,
	deleteDiscipline,
	restoreDiscipline,
	purgeDiscipline,
	getTrashedDisciplines,
	getDisciplinesCounts,
	publishDiscipline,
	unpublishDiscipline,
	bulkDeleteDisciplines,
	bulkPurgeDisciplines,
} from "../controllers/disciplineController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Discipline routes
router.get("/", getDisciplines);
router.get("/search", searchDisciplines);
router.get("/trash", getTrashedDisciplines);
router.get("/counts", getDisciplinesCounts);
router.post("/", createDiscipline);
router.post("/find-or-create", findOrCreateDiscipline);
router.post("/bulk-delete", bulkDeleteDisciplines);
router.post("/bulk-purge", bulkPurgeDisciplines);
router.get("/:id", getDisciplineById);
router.put("/:id", updateDiscipline);
router.delete("/:id", deleteDiscipline);
router.post("/:id/restore", restoreDiscipline);
router.post("/:id/purge", purgeDiscipline);
router.post("/:id/publish", publishDiscipline);
router.post("/:id/unpublish", unpublishDiscipline);

export default router;
