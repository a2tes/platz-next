import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

// GET /api/public/navbar
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		// Fetch photographers with their categories
		const photographers = await prisma.photographer.findMany({
			where: {
				status: "PUBLISHED",
				purgedAt: null,
				deletedAt: null,
				photography: {
					some: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
				},
			},
			orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
			select: {
				title: true,
				slug: true,
				photography: {
					where: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
					select: {
						categories: {
							select: {
								category: {
									select: { slug: true },
								},
							},
						},
					},
				},
			},
		});

		// Transform photographers to include categories
		const transformedPhotographers = photographers.map((item) => ({
			title: item.title,
			slug: item.slug,
			categories: item.photography
				.flatMap((p) => p.categories.map((c) => c.category?.slug))
				.filter((slug): slug is string => slug !== null && slug !== undefined)
				.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i), // Remove duplicates
		}));

		// Fetch categories with their photographers
		const categories = await prisma.photoCategory.findMany({
			where: {
				status: "PUBLISHED",
				purgedAt: null,
				deletedAt: null,
				photography: {
					some: {
						photography: {
							status: "PUBLISHED",
							purgedAt: null,
							deletedAt: null,
						},
					},
				},
			},
			orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
			select: {
				title: true,
				slug: true,
				photography: {
					where: {
						photography: {
							status: "PUBLISHED",
							purgedAt: null,
							deletedAt: null,
						},
					},
					select: {
						photography: {
							select: {
								photographer: {
									select: { slug: true },
								},
							},
						},
					},
				},
			},
		});

		// Transform categories to include photographers
		const transformedCategories = categories.map((item) => ({
			title: item.title,
			slug: item.slug,
			photographers: item.photography
				.map((p) => p.photography?.photographer?.slug)
				.filter((slug): slug is string => slug !== null && slug !== undefined)
				.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i), // Remove duplicates
		}));

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
			photographers: transformedPhotographers,
			categories: transformedCategories,
		});
	}),
);

export default router;
