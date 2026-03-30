import { Router } from "express";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

export default router;
