import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

// GET /api/public/navbar
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		// Fetch static pages for navbar
		const pages = await prisma.contentPage.findMany({
			where: {
				status: "PUBLISHED",
				deletedAt: null,
				type: { in: ["ABOUT", "CONTACT"] },
			},
			select: {
				title: true,
				slug: true,
				type: true,
			},
		});

		res.set("Cache-Control", "public, max-age=300, s-maxage=900");
		res.json({
			pages: pages,
		});
	}),
);

export default router;
