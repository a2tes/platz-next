import { prisma } from "../config/database";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { Status, TaxonomyType } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateTaxonomyData {
	name: string;
	type: TaxonomyType;
	status?: Status;
	sortOrder?: number;
	ogImageId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	metadata?: any;
	createdBy?: number;
}

export interface UpdateTaxonomyData {
	name?: string;
	slug?: string;
	status?: Status;
	sortOrder?: number;
	ogImageId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	metadata?: any;
}

export interface GetTaxonomiesQuery {
	page?: number;
	limit?: number;
	search?: string;
	sortBy?: "name" | "createdAt" | "updatedAt" | "sortOrder";
	sortOrder?: "asc" | "desc";
	status?: Status;
	mine?: boolean;
	userId?: number;
}

// ============================================
// TAXONOMY SERVICE
// ============================================

export class TaxonomyService {
	/**
	 * Get paginated taxonomies by type with optional search
	 */
	async getTaxonomies(type: TaxonomyType, query: GetTaxonomiesQuery = {}) {
		const { page = 1, limit = 10, search, sortBy = "name", sortOrder = "asc", status, mine, userId } = query;

		const where: any = {
			type,
			deletedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		if (status) {
			where.status = status;
		}

		if (mine && userId) {
			where.createdBy = userId;
		}

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [taxonomies, total] = await Promise.all([
			prisma.taxonomy.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
					ogImage: true,
					_count: {
						select: {
							works: true,
						},
					},
				},
			}),
			prisma.taxonomy.count({ where }),
		]);

		return {
			taxonomies,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get all taxonomies by type without pagination (for autocomplete)
	 */
	async getAllTaxonomies(type: TaxonomyType, query: { search?: string; limit?: number } = {}) {
		const { search, limit } = query;

		const where: any = {
			type,
			deletedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		return prisma.taxonomy.findMany({
			where,
			orderBy: { name: "asc" },
			take: limit,
		});
	}

	/**
	 * Get a taxonomy by ID
	 */
	async getTaxonomyById(id: number) {
		return prisma.taxonomy.findUnique({
			where: { id },
			include: {
				creator: { select: { id: true, name: true } },
				ogImage: true,
				_count: {
					select: {
						works: true,
					},
				},
			},
		});
	}

	/**
	 * Create a new taxonomy
	 */
	async createTaxonomy(data: CreateTaxonomyData) {
		const baseSlug = slugify(data.name);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.taxonomy.findUnique({
				where: { type_slug: { type: data.type, slug: s } },
			});
			return !!existing;
		});

		return prisma.taxonomy.create({
			data: {
				type: data.type,
				name: data.name,
				slug,
				status: data.status || "PUBLISHED",
				sortOrder: data.sortOrder || 0,
				ogImageId: data.ogImageId || null,
				metaDescription: data.metaDescription || null,
				metaKeywords: data.metaKeywords || null,
				metadata: data.metadata || undefined,
				createdBy: data.createdBy,
			},
			include: {
				creator: { select: { id: true, name: true } },
				ogImage: true,
			},
		});
	}

	/**
	 * Update a taxonomy
	 */
	async updateTaxonomy(id: number, data: UpdateTaxonomyData) {
		const updateData: any = { ...data };

		// If name is being updated, regenerate slug
		if (data.name && !data.slug) {
			const existing = await prisma.taxonomy.findUnique({ where: { id } });
			if (existing) {
				const baseSlug = slugify(data.name);
				updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
					const found = await prisma.taxonomy.findFirst({
						where: {
							type: existing.type,
							slug: s,
							id: { not: id },
						},
					});
					return !!found;
				});
			}
		}

		return prisma.taxonomy.update({
			where: { id },
			data: updateData,
			include: {
				creator: { select: { id: true, name: true } },
				ogImage: true,
			},
		});
	}

	/**
	 * Soft delete a taxonomy
	 */
	async deleteTaxonomy(id: number) {
		return prisma.taxonomy.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	}

	/**
	 * Restore a soft-deleted taxonomy
	 */
	async restoreTaxonomy(id: number) {
		return prisma.taxonomy.update({
			where: { id },
			data: { deletedAt: null },
		});
	}

	/**
	 * Permanently delete (purge) a taxonomy
	 */
	async purgeTaxonomy(id: number) {
		return prisma.taxonomy.delete({
			where: { id },
		});
	}

	/**
	 * Bulk soft delete taxonomies
	 */
	async bulkDelete(ids: number[]) {
		return prisma.taxonomy.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: new Date() },
		});
	}

	/**
	 * Bulk purge taxonomies
	 */
	async bulkPurge(ids: number[]) {
		return prisma.taxonomy.deleteMany({
			where: { id: { in: ids } },
		});
	}

	/**
	 * Publish a taxonomy
	 */
	async publishTaxonomy(id: number) {
		return prisma.taxonomy.update({
			where: { id },
			data: { status: "PUBLISHED" },
		});
	}

	/**
	 * Unpublish a taxonomy
	 */
	async unpublishTaxonomy(id: number) {
		return prisma.taxonomy.update({
			where: { id },
			data: { status: "DRAFT" },
		});
	}

	/**
	 * Get trashed taxonomies by type
	 */
	async getTrashedTaxonomies(type: TaxonomyType, query: GetTaxonomiesQuery = {}) {
		const { page = 1, limit = 10, search, sortBy = "name", sortOrder = "asc" } = query;

		const where: any = {
			type,
			deletedAt: { not: null },
			purgedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [taxonomies, total] = await Promise.all([
			prisma.taxonomy.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
				},
			}),
			prisma.taxonomy.count({ where }),
		]);

		return {
			taxonomies,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get counts for a taxonomy type
	 */
	async getCounts(type: TaxonomyType) {
		const [all, draft, published, trashed] = await Promise.all([
			prisma.taxonomy.count({ where: { type, deletedAt: null } }),
			prisma.taxonomy.count({ where: { type, deletedAt: null, status: "DRAFT" } }),
			prisma.taxonomy.count({ where: { type, deletedAt: null, status: "PUBLISHED" } }),
			prisma.taxonomy.count({ where: { type, deletedAt: { not: null }, purgedAt: null } }),
		]);

		return { all, draft, published, trashed };
	}

	/**
	 * Find or create a taxonomy by name and type
	 */
	async findOrCreate(type: TaxonomyType, name: string, createdBy?: number) {
		const existing = await prisma.taxonomy.findFirst({
			where: { type, name: { equals: name }, deletedAt: null },
		});

		if (existing) {
			return existing;
		}

		return this.createTaxonomy({ type, name, createdBy });
	}

	/**
	 * Search taxonomies by type for autocomplete
	 */
	async searchTaxonomies(type: TaxonomyType, search: string, limit: number = 10) {
		return prisma.taxonomy.findMany({
			where: {
				type,
				name: { contains: search },
				deletedAt: null,
			},
			orderBy: { name: "asc" },
			take: limit,
		});
	}

	/**
	 * Reorder taxonomies by type
	 */
	async reorder(type: TaxonomyType, orderedIds: number[]) {
		await prisma.$transaction(
			orderedIds.map((id, index) =>
				prisma.taxonomy.update({
					where: { id },
					data: { sortOrder: index },
				}),
			),
		);
	}
}

// Export singleton instance
export const taxonomyService = new TaxonomyService();
