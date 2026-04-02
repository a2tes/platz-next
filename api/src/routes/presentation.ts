import express from "express";
import * as presentationController from "../controllers/presentationController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// All routes here are protected
router.use(authenticateToken);

router.get("/", presentationController.getAllPresentations);
router.get("/counts", presentationController.getPresentationCounts);
router.get("/:id", presentationController.getPresentationById);
router.post("/", presentationController.createPresentation);
router.put("/:id", presentationController.updatePresentation);
router.delete("/:id", presentationController.deletePresentation);
router.delete("/:id/purge", presentationController.purgePresentation);
router.patch("/:id/restore", presentationController.restorePresentation);

export default router;
