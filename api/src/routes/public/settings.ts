import { Router, Request, Response } from "express";
import { SettingsService } from "../../services/settingsService";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

// GET /api/public/settings
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		const settings = await SettingsService.getAll();
		res.json({ success: true, data: settings });
	}),
);

export default router;
