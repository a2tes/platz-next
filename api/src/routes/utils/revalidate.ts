import { Router } from "express";
import { revalidatePaths } from "../../services/revalidateService";

const router = Router();

// Dev/ops utility endpoint to trigger website revalidation.
// Protection:
// - Allowed in non-production by default
// - In production, requires Authorization: Bearer <INTERNAL_TASK_SECRET>
router.post("/", async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const authHeader = req.headers["authorization"] || "";
  const requiredToken = `Bearer ${process.env.INTERNAL_TASK_SECRET || ""}`;
  const allowed = !isProd || authHeader === requiredToken;
  if (!allowed) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not allowed" } });
  }

  const paths = Array.isArray(req.body?.paths) ? (req.body.paths as string[]) : [];
  if (paths.length === 0) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "'paths' array is required" } });
  }

  try {
    const result = await revalidatePaths(paths);
    return res.status(result.ok ? 200 : 502).json({ success: result.ok, data: result.body, status: result.status });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: "REVALIDATE_ERROR", message: err?.message || "Unknown error" } });
  }
});

export default router;
