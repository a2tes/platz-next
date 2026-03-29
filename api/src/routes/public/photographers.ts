import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler, createApiError } from "../../middleware/errorHandler";

const router = Router();

// GET /api/public/photographers
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		const page = Math.max(1, Number(req.query.page ?? 1));
		const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 100)));
		const search = typeof req.query.search === "string" ? req.query.search : "";

		const where: any = {
			status: "PUBLISHED",
			purgedAt: null,
			deletedAt: null,
			// Only photographers with at least one published photography item
			photography: {
				some: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
			},
		};
		if (search) {
			where.OR = [{ title: { contains: search, mode: "insensitive" } }];
		}

		const [total, items] = await Promise.all([
			prisma.photographer.count({ where }),
			prisma.photographer.findMany({
				where,
				orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
				skip: (page - 1) * limit,
				take: limit,
				select: {
					title: true,
					slug: true,
					photography: {
						where: { status: "PUBLISHED", purgedAt: null, deletedAt: null },
						select: {
							taxonomies: {
								where: { taxonomy: { type: "PHOTO_CATEGORY" } },
								select: {
									taxonomy: {
										select: { slug: true },
									},
								},
							},
						},
					},
				},
			}),
		]);

		// Transform to include categories
		const transformedItems = items.map((item) => ({
			title: item.title,
			slug: item.slug,
			categories: item.photography
				.flatMap((p: any) => p.taxonomies.map((t: any) => t.taxonomy?.slug))
				.filter((slug: any): slug is string => slug !== null && slug !== undefined)
				.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i), // Remove duplicates
		}));

		res.set("Cache-Control", "public, max-age=300, s-maxage=900");
		res.json({
			success: true,
			data: transformedItems,
			meta: {
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	}),
);

// GET /api/public/photographers/:slug
router.get(
	"/:slug",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		const p = await prisma.photographer.findFirst({
			where: {
				slug,
				status: "PUBLISHED" as any,
				purgedAt: null,
				deletedAt: null,
			},
			select: {
				title: true,
				slug: true,
				bio: true,
				tags: true,
				metaDescription: true,
				metaKeywords: true,
				createdAt: true,
				publishedAt: true,
			},
		});
		if (!p) throw createApiError.notFound("Photographer not found");

		res.set("Cache-Control", "public, max-age=600, s-maxage=1800");
		res.json({ success: true, data: p });
	}),
);

export default router;
