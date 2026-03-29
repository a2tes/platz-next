import { Router } from "express";
import { directorsPageController } from "../controllers/directorsPageController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/selections", directorsPageController.getSelections.bind(directorsPageController));
router.post("/selections", directorsPageController.addSelection.bind(directorsPageController));
router.delete("/selections/:id", directorsPageController.removeSelection.bind(directorsPageController));
router.put("/selections/reorder", directorsPageController.reorder.bind(directorsPageController));
router.put("/selections/:id/video-source", directorsPageController.updateVideoSource.bind(directorsPageController));
router.post("/selections/:id/process-clip", directorsPageController.processClip.bind(directorsPageController));

export default router;
