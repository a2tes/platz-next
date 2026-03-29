import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

// GET /api/public/photo-categories
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		const page = Math.max(1, Number(req.query.page ?? 1));
		const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 200)));
		const search = typeof req.query.search === "string" ? req.query.search : "";

		const where: any = {
			type: "PHOTO_CATEGORY",
			status: "PUBLISHED",
			purgedAt: null,
			deletedAt: null,
			// Only categories with at least one published photography item
			photography: {
				some: {
					photography: {
						status: "PUBLISHED" as any,
						purgedAt: null,
						deletedAt: null,
					},
				},
			},
		};
		if (search) {
			where.OR = [{ name: { contains: search, mode: "insensitive" } }];
		}

		const [total, items] = await Promise.all([
			prisma.taxonomy.count({ where }),
			prisma.taxonomy.findMany({
				where,
				orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
				skip: (page - 1) * limit,
				take: limit,
				select: {
					name: true,
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
			}),
		]);

		// Transform to include photographers
		const transformedItems = items.map((item) => ({
			title: item.name,
			slug: item.slug,
			photographers: item.photography
				.map((p) => p.photography?.photographer?.slug)
				.filter((slug): slug is string => slug !== null && slug !== undefined)
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

export default router;
