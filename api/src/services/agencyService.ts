import { prisma } from "../config/database";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { Status } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateAgencyData {
	name: string;
	status?: Status;
	createdBy?: number;
}

export interface UpdateAgencyData {
	name?: string;
	slug?: string;
	status?: Status;
}

export interface GetAgenciesQuery {
	page?: number;
	limit?: number;
	search?: string;
	sortBy?: "name" | "createdAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	status?: Status;
	mine?: boolean;
	userId?: number;
}

// ============================================
// AGENCY SERVICE
// ============================================

export class AgencyService {
	/**
	 * Get paginated agencies with optional search
	 */
	async getAgencies(query: GetAgenciesQuery = {}) {
		const { page = 1, limit = 10, search, sortBy = "name", sortOrder = "asc", status, mine, userId } = query;

		const where: any = {
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

		const [agencies, total] = await Promise.all([
			prisma.agency.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
					_count: {
						select: {
							works: true,
							photography: true,
							animations: true,
						},
					},
				},
			}),
			prisma.agency.count({ where }),
		]);

		return {
			agencies,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get all agencies without pagination (for autocomplete)
	 */
	async getAllAgencies(query: { search?: string; limit?: number } = {}) {
		const { search, limit } = query;

		const where: any = {
			deletedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		return prisma.agency.findMany({
			where,
			orderBy: { name: "asc" },
			take: limit,
		});
	}

	/**
	 * Get an agency by ID
	 */
	async getAgencyById(id: number) {
		return prisma.agency.findUnique({
			where: { id },
			include: {
				creator: { select: { id: true, name: true } },
				_count: {
					select: {
						works: true,
						photography: true,
						animations: true,
					},
				},
			},
		});
	}

	/**
	 * Get an agency by slug
	 */
	async getAgencyBySlug(slug: string) {
		return prisma.agency.findUnique({
			where: { slug },
		});
	}

	/**
	 * Create a new agency
	 */
	async createAgency(data: CreateAgencyData) {
		const baseSlug = slugify(data.name);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.agency.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		return prisma.agency.create({
			data: {
				name: data.name,
				slug,
				status: data.status || "PUBLISHED",
				createdBy: data.createdBy,
			},
			include: {
				creator: { select: { id: true, name: true } },
			},
		});
	}

	/**
	 * Update an agency
	 */
	async updateAgency(id: number, data: UpdateAgencyData) {
		const updateData: any = { ...data };

		// If name is being updated, regenerate slug
		if (data.name && !data.slug) {
			const baseSlug = slugify(data.name);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.agency.findFirst({
					where: { slug: s, id: { not: id } },
				});
				return !!existing;
			});
		}

		return prisma.agency.update({
			where: { id },
			data: updateData,
			include: {
				creator: { select: { id: true, name: true } },
			},
		});
	}

	/**
	 * Soft delete an agency
	 */
	async deleteAgency(id: number) {
		return prisma.agency.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	}

	/**
	 * Restore a soft-deleted agency
	 */
	async restoreAgency(id: number) {
		return prisma.agency.update({
			where: { id },
			data: { deletedAt: null },
		});
	}

	/**
	 * Permanently delete (purge) an agency
	 */
	async purgeAgency(id: number) {
		return prisma.agency.delete({
			where: { id },
		});
	}

	/**
	 * Bulk soft delete agencies
	 */
	async bulkDeleteAgencies(ids: number[]) {
		return prisma.agency.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: new Date() },
		});
	}

	/**
	 * Bulk purge agencies
	 */
	async bulkPurgeAgencies(ids: number[]) {
		return prisma.agency.deleteMany({
			where: { id: { in: ids } },
		});
	}

	/**
	 * Publish an agency
	 */
	async publishAgency(id: number) {
		return prisma.agency.update({
			where: { id },
			data: { status: "PUBLISHED" },
		});
	}

	/**
	 * Unpublish an agency
	 */
	async unpublishAgency(id: number) {
		return prisma.agency.update({
			where: { id },
			data: { status: "DRAFT" },
		});
	}

	/**
	 * Get trashed agencies
	 */
	async getTrashedAgencies(query: GetAgenciesQuery = {}) {
		const { page = 1, limit = 10, search, sortBy = "name", sortOrder = "asc" } = query;

		const where: any = {
			deletedAt: { not: null },
			purgedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [agencies, total] = await Promise.all([
			prisma.agency.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
				},
			}),
			prisma.agency.count({ where }),
		]);

		return {
			agencies,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get counts for agencies
	 */
	async getCounts() {
		const [all, draft, published, trashed] = await Promise.all([
			prisma.agency.count({ where: { deletedAt: null } }),
			prisma.agency.count({ where: { deletedAt: null, status: "DRAFT" } }),
			prisma.agency.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
			prisma.agency.count({ where: { deletedAt: { not: null }, purgedAt: null } }),
		]);

		return { all, draft, published, trashed };
	}

	/**
	 * Find or create an agency by name
	 * Used for autocomplete fields that allow creating new entries
	 */
	async findOrCreateAgency(name: string, createdBy?: number) {
		// First try to find by exact name match (case-insensitive)
		const existing = await prisma.agency.findFirst({
			where: { name: { equals: name }, deletedAt: null },
		});

		if (existing) {
			return existing;
		}

		// Create new agency
		return this.createAgency({ name, createdBy });
	}

	/**
	 * Search agencies for autocomplete
	 */
	async searchAgencies(search: string, limit: number = 10) {
		return prisma.agency.findMany({
			where: {
				name: { contains: search },
				deletedAt: null,
			},
			orderBy: { name: "asc" },
			take: limit,
		});
	}
}

// Export singleton instance
export const agencyService = new AgencyService();
