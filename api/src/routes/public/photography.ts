import { Router, Request, Response } from "express";
import { prisma } from "../../config/database";
import { asyncHandler, createApiError } from "../../middleware/errorHandler";
import { serializeMediaFile, buildCroppedUrl } from "../../utils/serialization";

const router = Router();

// GET /api/public/photography
router.get(
	"/",
	asyncHandler(async (req: Request, res: Response) => {
		const search = typeof req.query.search === "string" ? req.query.search : "";
		const photographerSlug = typeof req.query.photographer === "string" ? req.query.photographer : undefined;
		const categorySlug = typeof req.query.category === "string" ? req.query.category : undefined;
		const clientSlug = typeof req.query.client === "string" ? req.query.client : undefined;
		const groupSlug = typeof req.query.group === "string" ? req.query.group : undefined; // Client group slug for grouped view

		// Determine PRIMARY filter based on which parameter comes first in the URL
		// If both are present, only use the primary one for fetching items
		const queryKeys = Object.keys(req.query);
		const photoIndex = queryKeys.indexOf("photographer");
		const catIndex = queryKeys.indexOf("category");
		const clientIndex = queryKeys.indexOf("client");
		const isPrimaryPhotographer =
			photographerSlug &&
			(catIndex === -1 || photoIndex < catIndex) &&
			(clientIndex === -1 || photoIndex < clientIndex);
		const isPrimaryCategory =
			categorySlug && (photoIndex === -1 || catIndex < photoIndex) && (clientIndex === -1 || catIndex < clientIndex);
		const isPrimaryClient =
			clientSlug && (photoIndex === -1 || clientIndex < photoIndex) && (catIndex === -1 || clientIndex < catIndex);

		// Resolve optional filters
		let photographerId: number | undefined;
		let categoryId: number | undefined;
		let clientId: number | undefined;
		let selectedPhotographer:
			| {
					title: string;
					slug: string;
					bio?: string;
					groupByClient?: boolean;
					avatar?: string;
					coverImage?: string;
					metaDescription?: string;
					metaKeywords?: string;
					ogImageUrl?: string;
			  }
			| undefined;
		let selectedCategory: { id: number; title: string; slug: string } | undefined;
		let selectedClient: { id: number; title: string; slug: string } | undefined;

		// Only resolve the primary filter for fetching items
		if (isPrimaryPhotographer && photographerSlug) {
			const p = await prisma.photographer.findFirst({
				where: {
					slug: photographerSlug,
					status: "PUBLISHED" as any,
					purgedAt: null,
					deletedAt: null,
				},
				include: {
					coverImage: true,
					avatar: true,
					previewImage: true,
				},
			});
			if (!p) {
				return res.status(404).json({
					error: "Photographer not found",
					code: "PHOTOGRAPHER_NOT_FOUND",
				});
			}
			photographerId = p.id;

			// Fetch mediables (crop configurations) for avatar, cover, and preview image
			const mediables = await (prisma as any).mediable.findMany({
				where: {
					subjectType: "Photographer",
					subjectId: p.id,
					usageKey: { in: ["avatar", "cover", "preview"] },
				},
			});

			const avatarMediable = mediables.find((m: any) => m.usageKey === "avatar");
			const coverMediable = mediables.find((m: any) => m.usageKey === "cover");
			const previewMediable = mediables.find((m: any) => m.usageKey === "preview");

			// Build cropped URLs directly as strings
			const avatarUrl = buildCroppedUrl(p.avatar, avatarMediable, {
				w: 300,
				q: 85,
			});
			const coverUrl = buildCroppedUrl(p.coverImage, coverMediable, {
				w: 1920,
				q: 90,
			});

			// Build OG image URL from previewImage
			const ogImageUrl = (p as any).previewImage
				? buildCroppedUrl((p as any).previewImage, previewMediable, { w: 1200, h: 630 })
				: null;

			selectedPhotographer = {
				title: p.title,
				slug: p.slug,
				bio: p.bio || undefined,
				groupByClient: p.groupByClient,
				avatar: avatarUrl,
				coverImage: coverUrl,
				metaDescription: p.metaDescription || undefined,
				metaKeywords: p.metaKeywords || undefined,
				ogImageUrl: ogImageUrl || undefined,
			} as any;
		}

		if (isPrimaryCategory && categorySlug) {
			const c = await prisma.photoCategory.findFirst({
				where: {
					slug: categorySlug,
					status: "PUBLISHED" as any,
					purgedAt: null,
					deletedAt: null,
				},
				select: { id: true, title: true, slug: true },
			});
			if (!c) {
				return res.status(404).json({
					error: "Category not found",
					code: "CATEGORY_NOT_FOUND",
				});
			}
			categoryId = c.id;
			selectedCategory = c as any;
		}

		// Handle client filter
		if (isPrimaryClient && clientSlug) {
			const client = await prisma.client.findFirst({
				where: {
					slug: clientSlug,
				},
				select: { id: true, name: true, slug: true },
			});
			if (!client) {
				return res.status(404).json({
					error: "Client not found",
					code: "CLIENT_NOT_FOUND",
				});
			}
			clientId = client.id;
			selectedClient = { id: client.id, title: client.name, slug: client.slug };
		}

		const where: any = {
			status: "PUBLISHED",
			purgedAt: null,
			deletedAt: null,
			// Ensure related photographer is PUBLISHED
			AND: [
				{
					photographer: {
						status: "PUBLISHED",
						purgedAt: null,
						deletedAt: null,
					} as any,
				},
				// Ensure at least one category is PUBLISHED
				{
					categories: {
						some: {
							category: {
								status: "PUBLISHED",
								purgedAt: null,
								deletedAt: null,
							},
						},
					} as any,
				},
			],
			...(photographerId ? { photographerId } : {}),
			...(categoryId ? { categories: { some: { categoryId } } } : {}),
			...(clientId ? { clients: { some: { clientId } } } : {}),
		};
		if (search) {
			where.OR = [
				{ title: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
				{ client: { contains: search, mode: "insensitive" } },
			];
		}

		const items = await prisma.photography.findMany({
			where,
			orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
			include: {
				image: true,
				photographer: { select: { title: true, slug: true } },
				categories: {
					include: {
						category: { select: { title: true, slug: true } },
					},
				},
				clients: {
					include: {
						client: { select: { name: true, slug: true } },
					},
				},
			},
		});

		const data = items.map((it) => {
			const image = serializeMediaFile((it as any).image);
			// Get first client from junction table if available
			const firstClient = (it as any).clients?.[0]?.client;
			// Get first category from junction table
			const firstCategory = (it as any).categories?.[0]?.category;
			return {
				title: it.title,
				slug: it.slug,
				description: it.description,
				year: it.year,
				location: it.location,
				client: firstClient?.name || it.client, // Prefer junction table client
				clientSlug: firstClient?.slug || null,
				images: image?.images || null,
				photographer: (it as any).photographer,
				category: firstCategory || null,
				categories: (it as any).categories?.map((c: any) => c.category) || [],
			} as any;
		});

		// Build photographers/categories/clients lists for tabs
		// IMPORTANT: We always return the secondary filter list, regardless of what's in the URL
		// - If primary filter is photographer, return categories-of-photographer
		// - If primary filter is category, return photographers-of-category
		// - If primary filter is client, return photographers and categories of that client's photos
		const [photographers, categoriesAll, clientsAll] = await Promise.all([
			isPrimaryPhotographer || isPrimaryClient
				? Promise.resolve([])
				: prisma.photographer.findMany({
						where: {
							status: "PUBLISHED" as any,
							purgedAt: null,
							deletedAt: null,
							photography: {
								some: {
									status: "PUBLISHED" as any,
									purgedAt: null,
									deletedAt: null,
									...(categoryId ? { categories: { some: { categoryId } } } : {}),
									...(clientId ? { clients: { some: { clientId } } } : {}),
								},
							},
						},
						select: { title: true, slug: true },
						orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
					}),
			isPrimaryCategory || isPrimaryClient
				? Promise.resolve([])
				: prisma.photoCategory.findMany({
						where: {
							status: "PUBLISHED" as any,
							purgedAt: null,
							deletedAt: null,
							photography: {
								some: {
									photography: {
										status: "PUBLISHED" as any,
										purgedAt: null,
										deletedAt: null,
										...(photographerId ? { photographerId } : {}),
										...(clientId ? { clients: { some: { clientId } } } : {}),
									},
								},
							},
						},
						select: { title: true, slug: true },
						orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
					}),
			// Get clients that have photography
			prisma.client.findMany({
				where: {
					photography: {
						some: {
							photography: {
								status: "PUBLISHED" as any,
								purgedAt: null,
								deletedAt: null,
								...(photographerId ? { photographerId } : {}),
								...(categoryId ? { categories: { some: { categoryId } } } : {}),
							},
						},
					},
				},
				select: { name: true, slug: true },
				orderBy: { createdAt: "desc" },
			}),
		]);

		// Build response
		// - If primary is photographer, include categories for tabs
		// - If primary is category, include photographers for tabs
		// - If primary is client, include the client info
		const categories = isPrimaryPhotographer ? categoriesAll : [];
		const finalPhotographers = isPrimaryCategory ? photographers : [];

		// Transform clients to have 'title' for consistency
		const clientsForResponse = clientsAll.map((c: any) => ({ title: c.name, slug: c.slug }));

		const response: any = { items: data, clients: clientsForResponse };

		// Helper function to build client groups from items
		const buildClientGroups = (items: any[]) => {
			const clientGroupsMap = new Map<string, { title: string; slug: string; cover: any; count: number }>();
			const uncategorizedItems: any[] = [];

			for (const item of items) {
				if (item.clientSlug) {
					if (!clientGroupsMap.has(item.clientSlug)) {
						clientGroupsMap.set(item.clientSlug, {
							title: item.client,
							slug: item.clientSlug,
							cover: item.images,
							count: 1,
						});
					} else {
						const group = clientGroupsMap.get(item.clientSlug)!;
						group.count++;
					}
				} else {
					uncategorizedItems.push(item);
				}
			}

			// Convert map to array and add uncategorized at the end
			const clientGroups = Array.from(clientGroupsMap.values());
			if (uncategorizedItems.length > 0) {
				clientGroups.push({
					title: "Uncategorized",
					slug: "_uncategorized",
					cover: uncategorizedItems[0]?.images || null,
					count: uncategorizedItems.length,
				});
			}

			return clientGroups;
		};

		// Handle grouping for main photography page (no filters)
		const isMainPage = !isPrimaryPhotographer && !isPrimaryCategory && !isPrimaryClient;
		if (isMainPage && !groupSlug) {
			// On main page, always show client groups
			response.clientGroups = buildClientGroups(data);
			// Keep items for potential client-side filtering
		} else if (isMainPage && groupSlug) {
			// Filter by group on main page
			if (groupSlug === "_uncategorized") {
				response.items = data.filter((item: any) => !item.clientSlug);
				response.selectedGroup = { title: "Uncategorized", slug: "_uncategorized" };
			} else {
				response.items = data.filter((item: any) => item.clientSlug === groupSlug);
				const selectedGroupClient = response.items[0];
				if (selectedGroupClient) {
					response.selectedGroup = { title: selectedGroupClient.client, slug: groupSlug };
				}
			}
		}

		// Include the selected photographer with coverImage if primary
		if (isPrimaryPhotographer && selectedPhotographer) {
			response.photographer = selectedPhotographer;
			response.categories = categories;

			// Handle client grouping for photographer pages
			if (selectedPhotographer.groupByClient && !groupSlug) {
				response.clientGroups = buildClientGroups(data);
				// Keep items for client-side category filtering of groups
				// Client will hide items and show groups based on shouldShowClientGroups
			}

			// If groupSlug is provided, filter items by client
			if (groupSlug) {
				if (groupSlug === "_uncategorized") {
					response.items = data.filter((item: any) => !item.clientSlug);
					response.selectedGroup = { title: "Uncategorized", slug: "_uncategorized" };
				} else {
					response.items = data.filter((item: any) => item.clientSlug === groupSlug);
					const selectedGroupClient = response.items[0];
					if (selectedGroupClient) {
						response.selectedGroup = { title: selectedGroupClient.client, slug: groupSlug };
					}
				}
			}
		}
		if (isPrimaryCategory) {
			response.photographers = finalPhotographers;
		}
		if (isPrimaryClient && selectedClient) {
			response.client = selectedClient;
			// For client primary view, we might want photographers as tabs
			response.photographers = await prisma.photographer.findMany({
				where: {
					status: "PUBLISHED" as any,
					purgedAt: null,
					deletedAt: null,
					photography: {
						some: {
							status: "PUBLISHED" as any,
							purgedAt: null,
							deletedAt: null,
							clients: { some: { clientId } },
						},
					},
				},
				select: { title: true, slug: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
			});
		}

		res.set("Cache-Control", "public, max-age=120, s-maxage=600");
		res.json(response);
	}),
);

// GET /api/public/photography/:slug
router.get(
	"/:slug",
	asyncHandler(async (req: Request, res: Response) => {
		const slug = req.params.slug as string;
		if (!slug) throw createApiError.badRequest("Slug is required");

		const it = await prisma.photography.findFirst({
			where: {
				slug,
				status: "PUBLISHED" as any,
				purgedAt: null,
				deletedAt: null,
				AND: [
					{
						photographer: {
							status: "PUBLISHED",
							purgedAt: null,
							deletedAt: null,
						} as any,
					},
					{
						categories: {
							some: {
								category: {
									status: "PUBLISHED",
									purgedAt: null,
									deletedAt: null,
								},
							},
						} as any,
					},
				],
			},
			include: {
				image: true,
				photographer: { select: { id: true, title: true, slug: true } },
				categories: {
					include: {
						category: { select: { id: true, title: true, slug: true } },
					},
				},
			},
		});
		if (!it) throw createApiError.notFound("Photography item not found");

		const item = it as any;
		const firstCategory = item.categories?.[0]?.category;
		const data = {
			id: item.id,
			title: item.title,
			slug: item.slug,
			description: item.description,
			year: item.year,
			location: item.location,
			client: item.client,

			image: serializeMediaFile(item.image),
			photographer: item.photographer,
			category: firstCategory || null,
			categories: item.categories?.map((c: any) => c.category) || [],
			createdAt: item.createdAt,
			publishedAt: item.publishedAt,
		} as any;

		res.set("Cache-Control", "public, max-age=300, s-maxage=900");
		res.json({ success: true, data });
	}),
);

export default router;
