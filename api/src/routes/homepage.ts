import { Router } from "express";
import { homepageController } from "../controllers/homepageController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/directors", homepageController.getSelections.bind(homepageController));
router.post("/directors", homepageController.addSelection.bind(homepageController));
router.delete("/directors/:id", homepageController.removeSelection.bind(homepageController));
router.put("/directors/reorder", homepageController.reorder.bind(homepageController));
router.put("/directors/selection/:id/video-source", homepageController.updateVideoSource.bind(homepageController));
router.post("/directors/selection/:id/process-clip", homepageController.processClip.bind(homepageController));

export default router;
