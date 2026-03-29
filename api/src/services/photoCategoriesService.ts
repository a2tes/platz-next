import { prisma } from "../config/database";
import { slugify, generateUniqueSlug } from "../utils/slugify";

export interface CreatePhotoCategoryData {
	title: string;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdatePhotoCategoryData {
	title?: string;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface GetPhotoCategoriesQuery {
	page: number;
	limit: number;
	search?: string;
	sortBy: "title" | "createdAt" | "updatedAt";
	sortOrder: "asc" | "desc";
	status?: "DRAFT" | "PUBLISHED" | "ALL";
	mine?: boolean;
}

export interface GetPhotoCategoriesOptions {
	includeTrashed?: boolean;
	includePurged?: boolean;
	currentUserId?: number;
}

export class PhotoCategoriesService {
	async createCategory(data: CreatePhotoCategoryData) {
		// Generate unique slug
		const baseSlug = slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.photoCategory.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		return prisma.photoCategory.create({
			data: {
				title: data.title,
				metaDescription: data.metaDescription || null,
				metaKeywords: data.metaKeywords || null,
				status: (data.status ?? "DRAFT") as any,
				slug,
				createdBy: (data as any).createdBy,
			} as any,
			include: { creator: true },
		});
	}

	async getCategories(query: GetPhotoCategoriesQuery, options: GetPhotoCategoriesOptions = {}) {
		const { page, limit, search, sortBy, sortOrder, status, mine } = query;
		const skip = (page - 1) * limit;

		const where: any = {};

		// Soft-delete visibility
		if (!options.includePurged) {
			where.purgedAt = null;
		}
		if (!options.includeTrashed) {
			where.deletedAt = null;
		} else {
			// Show only trashed items when includeTrashed is true
			where.deletedAt = { not: null };
		}

		// Mine scope: only categories created by current user
		if (mine && options.currentUserId) {
			where.createdBy = options.currentUserId;
		}

		if (status && status !== "ALL") where.status = status;
		if (search) {
			where.title = { contains: search };
		}

		// Prefer ordering by sortOrder first (requires DB column + generated Prisma client)
		const preferredOrderBy: any = [{ sortOrder: "asc" } as any, { [sortBy]: sortOrder } as any];
		const fallbackOrderBy: any = { [sortBy]: sortOrder } as any;

		try {
			const [items, total] = await Promise.all([
				prisma.photoCategory.findMany({
					where,
					include: { creator: true },
					orderBy: preferredOrderBy,
					skip,
					take: limit,
				}),
				prisma.photoCategory.count({ where }),
			]);

			return {
				categories: items,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (err) {
			// Fallback for environments where sortOrder column/client not yet available
			const [items, total] = await Promise.all([
				prisma.photoCategory.findMany({
					where,
					include: { creator: true },
					orderBy: fallbackOrderBy,
					skip,
					take: limit,
				}),
				prisma.photoCategory.count({ where }),
			]);

			return {
				categories: items,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		}
	}

	async reorder(orderedIds: number[]) {
		await prisma.$transaction(
			orderedIds.map((id, index) =>
				prisma.photoCategory.update({
					where: { id },
					data: { sortOrder: index } as any,
				}),
			),
		);
		return { message: "Reordered" };
	}

	async getCategoryById(id: number, options: { includeTrashed?: boolean; includePurged?: boolean } = {}) {
		return prisma.photoCategory.findFirst({
			where: {
				id,
				...(options.includePurged ? {} : { purgedAt: null }),
				...(options.includeTrashed ? {} : { deletedAt: null }),
			},
			include: { creator: true },
		});
	}

	async updateCategory(id: number, data: UpdatePhotoCategoryData) {
		const payload: any = { ...data };
		if (data.title) {
			// Generate unique slug
			const baseSlug = slugify(data.title);
			payload.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.photoCategory.findFirst({
					where: {
						slug: s,
						id: { not: id }, // Exclude current category
					},
				});
				return !!existing;
			});
		}

		return prisma.photoCategory.update({
			where: { id },
			data: payload,
			include: { creator: true },
		});
	}

	async deleteCategory(id: number) {
		// Soft delete - move to trash
		// Usage check is only for permanent purge
		return prisma.photoCategory.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	async trashCategory(id: number) {
		return prisma.photoCategory.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	async restoreCategory(id: number) {
		return prisma.photoCategory.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	async purgeCategory(id: number) {
		// Get category info
		const category = await prisma.photoCategory.findUnique({
			where: { id },
			select: { title: true },
		});

		if (!category) {
			throw new Error("Category not found");
		}

		// Check if category is used before permanent delete
		const usage = await prisma.photography.count({
			where: {
				categories: { some: { categoryId: id } },
				purgedAt: null, // Only count non-purged photos
			},
		});

		if (usage > 0) {
			throw new Error(
				`Cannot permanently delete "${category.title}". It is used by ${usage} photography ${
					usage === 1 ? "item" : "items"
				}`,
			);
		}

		return prisma.photoCategory.update({
			where: { id },
			data: { purgedAt: new Date() } as any,
		});
	}

	async getTrashedCategories(query: GetPhotoCategoriesQuery) {
		const { page, limit, search, sortBy, sortOrder } = query;
		const skip = (page - 1) * limit;

		const where: any = { purgedAt: null, deletedAt: { not: null } };
		if (search) where.OR = [{ title: { contains: search } }, { name: { contains: search } }];

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [items, total] = await Promise.all([
			prisma.photoCategory.findMany({
				where,
				include: { creator: true },
				orderBy,
				skip,
				take: limit,
			}),
			prisma.photoCategory.count({ where }),
		]);

		return {
			categories: items,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	async getFilterCounts(userId?: number) {
		const baseWhere = { purgedAt: null } as any;
		const nonTrashed = { ...baseWhere, deletedAt: null } as any;
		const trashed = { ...baseWhere, deletedAt: { not: null } } as any;

		const [all, mine, published, draft, trash] = await Promise.all([
			prisma.photoCategory.count({ where: nonTrashed }),
			userId
				? prisma.photoCategory.count({
						where: { ...nonTrashed, createdBy: userId },
					})
				: Promise.resolve(0),
			prisma.photoCategory.count({
				where: { ...nonTrashed, status: "PUBLISHED" },
			}),
			prisma.photoCategory.count({
				where: { ...nonTrashed, status: "DRAFT" },
			}),
			prisma.photoCategory.count({ where: trashed }),
		]);
		return { all, mine, published, draft, trash };
	}

	async publishCategory(id: number) {
		return prisma.photoCategory.update({
			where: { id },
			data: { status: "PUBLISHED" as any, updatedAt: new Date() } as any,
		});
	}

	async unpublishCategory(id: number) {
		return prisma.photoCategory.update({
			where: { id },
			data: { status: "DRAFT" as any, updatedAt: new Date() } as any,
		});
	}

	/**
	 * Bulk delete categories (move to Trash)
	 */
	async bulkDeleteCategories(ids: number[]) {
		if (!ids.length)
			return {
				deleted: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		const existing = await prisma.photoCategory.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: { id: true, title: true },
		});
		const validIds = existing.map((c) => c.id);

		if (validIds.length) {
			await prisma.photoCategory.updateMany({
				where: { id: { in: validIds } },
				data: { deletedAt: new Date() } as any,
			});
		}

		const skipped = ids
			.filter((id) => !validIds.includes(id))
			.map((id) => ({ id, reason: "Not found or already deleted" }));

		return { deleted: existing, skipped };
	}

	/**
	 * Bulk purge categories (skip if used by any photography item)
	 */
	async bulkPurgeCategories(ids: number[]) {
		if (!ids.length)
			return {
				purged: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Categories used by any non-purged photography items
		const usedCategoryRelations = await prisma.photographyCategory.findMany({
			where: {
				categoryId: { in: ids },
				photography: { purgedAt: null },
			},
			select: { categoryId: true },
			distinct: ["categoryId"],
		});
		const usedIds = new Set(usedCategoryRelations.map((u) => u.categoryId));

		const purgable = await prisma.photoCategory.findMany({
			where: {
				id: { in: ids.filter((id) => !usedIds.has(id)) },
				purgedAt: null,
			},
			select: { id: true, title: true },
		});
		const validIds = purgable.map((c) => c.id);

		if (validIds.length) {
			await prisma.photoCategory.updateMany({
				where: { id: { in: validIds } },
				data: { purgedAt: new Date() } as any,
			});
		}

		const skipped: Array<{ id: number; reason: string }> = [];
		for (const id of ids) {
			if (usedIds.has(id)) skipped.push({ id, reason: "Category is used by photography items" });
			else if (!validIds.includes(id)) skipped.push({ id, reason: "Not found or already deleted" });
		}

		return { purged: purgable, skipped };
	}

	/**
	 * Search categories for autocomplete
	 */
	async searchCategories(search: string, limit: number = 10) {
		return prisma.photoCategory.findMany({
			where: {
				title: { contains: search },
				deletedAt: null,
				purgedAt: null,
			},
			orderBy: { title: "asc" },
			take: limit,
		});
	}

	/**
	 * Find or create a category by name
	 */
	async findOrCreate(title: string) {
		// Try to find existing category (case-insensitive using raw query)
		const existing = await prisma.photoCategory.findFirst({
			where: {
				title: {
					equals: title,
				},
				deletedAt: null,
				purgedAt: null,
			},
		});

		if (existing) {
			return existing;
		}

		// Create new category with PUBLISHED status
		const baseSlug = slugify(title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const found = await prisma.photoCategory.findUnique({
				where: { slug: s },
			});
			return !!found;
		});

		return prisma.photoCategory.create({
			data: {
				title,
				slug,
				status: "PUBLISHED",
			} as any,
		});
	}
}

export const photoCategoriesService = new PhotoCategoriesService();
