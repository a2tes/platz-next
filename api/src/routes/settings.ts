import { Router } from "express";
import { SettingsController } from "../controllers/settingsController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

// All settings endpoints are admin-only
router.use(authenticateToken, requireAdmin);

// GET /api/settings - Get all site settings
router.get("/", SettingsController.getSettings);

// PUT /api/settings - Update multiple settings
router.put("/", SettingsController.updateSettings);

export default router;
