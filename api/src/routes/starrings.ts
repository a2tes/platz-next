import { Router } from "express";
import { starringController } from "../controllers/starringController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /starrings - Get all starrings
router.get("/", starringController.getAll);

// GET /starrings/search - Search starrings
router.get("/search", starringController.search);

// GET /starrings/:id - Get starring by ID
router.get("/:id", starringController.getById);

// POST /starrings - Create new starring
router.post("/", starringController.create);

// POST /starrings/find-or-create - Find or create starring
router.post("/find-or-create", starringController.findOrCreate);

// PUT /starrings/:id - Update starring
router.put("/:id", starringController.update);

// DELETE /starrings/:id - Delete starring
router.delete("/:id", starringController.delete);

export default router;
