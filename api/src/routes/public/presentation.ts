import express from "express";
import * as presentationController from "../../controllers/presentationController";

const router = express.Router();

router.get("/:token", presentationController.getPresentationByToken);

export default router;
