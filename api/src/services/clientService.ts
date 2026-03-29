import { prisma } from "../config/database";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { Status } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateClientData {
	name: string;
	status?: Status;
	createdBy?: number;
}

export interface UpdateClientData {
	name?: string;
	slug?: string;
	status?: Status;
}

export interface GetClientsQuery {
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
// CLIENT SERVICE
// ============================================

export class ClientService {
	/**
	 * Get paginated clients with optional search
	 */
	async getClients(query: GetClientsQuery = {}) {
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

		const [clients, total] = await Promise.all([
			prisma.client.findMany({
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
			prisma.client.count({ where }),
		]);

		return {
			clients,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get all clients without pagination (for autocomplete)
	 */
	async getAllClients(query: { search?: string; limit?: number } = {}) {
		const { search, limit } = query;

		const where: any = {
			deletedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		return prisma.client.findMany({
			where,
			orderBy: { name: "asc" },
			take: limit,
		});
	}

	/**
	 * Get a client by ID
	 */
	async getClientById(id: number) {
		return prisma.client.findUnique({
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
	 * Get a client by slug
	 */
	async getClientBySlug(slug: string) {
		return prisma.client.findUnique({
			where: { slug },
		});
	}

	/**
	 * Create a new client
	 */
	async createClient(data: CreateClientData) {
		const baseSlug = slugify(data.name);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.client.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		return prisma.client.create({
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
	 * Update a client
	 */
	async updateClient(id: number, data: UpdateClientData) {
		const updateData: any = { ...data };

		// If name is being updated, regenerate slug
		if (data.name && !data.slug) {
			const baseSlug = slugify(data.name);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.client.findFirst({
					where: { slug: s, id: { not: id } },
				});
				return !!existing;
			});
		}

		return prisma.client.update({
			where: { id },
			data: updateData,
			include: {
				creator: { select: { id: true, name: true } },
			},
		});
	}

	/**
	 * Soft delete a client
	 */
	async deleteClient(id: number) {
		return prisma.client.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	}

	/**
	 * Restore a soft-deleted client
	 */
	async restoreClient(id: number) {
		return prisma.client.update({
			where: { id },
			data: { deletedAt: null },
		});
	}

	/**
	 * Permanently delete (purge) a client
	 */
	async purgeClient(id: number) {
		return prisma.client.delete({
			where: { id },
		});
	}

	/**
	 * Bulk soft delete clients
	 */
	async bulkDeleteClients(ids: number[]) {
		return prisma.client.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: new Date() },
		});
	}

	/**
	 * Bulk purge clients
	 */
	async bulkPurgeClients(ids: number[]) {
		return prisma.client.deleteMany({
			where: { id: { in: ids } },
		});
	}

	/**
	 * Publish a client
	 */
	async publishClient(id: number) {
		return prisma.client.update({
			where: { id },
			data: { status: "PUBLISHED" },
		});
	}

	/**
	 * Unpublish a client
	 */
	async unpublishClient(id: number) {
		return prisma.client.update({
			where: { id },
			data: { status: "DRAFT" },
		});
	}

	/**
	 * Get trashed clients
	 */
	async getTrashedClients(query: GetClientsQuery = {}) {
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

		const [clients, total] = await Promise.all([
			prisma.client.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
				},
			}),
			prisma.client.count({ where }),
		]);

		return {
			clients,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get counts for clients
	 */
	async getCounts() {
		const [all, draft, published, trashed] = await Promise.all([
			prisma.client.count({ where: { deletedAt: null } }),
			prisma.client.count({ where: { deletedAt: null, status: "DRAFT" } }),
			prisma.client.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
			prisma.client.count({ where: { deletedAt: { not: null }, purgedAt: null } }),
		]);

		return { all, draft, published, trashed };
	}

	/**
	 * Find or create a client by name
	 * Used for autocomplete fields that allow creating new entries
	 */
	async findOrCreateClient(name: string, createdBy?: number) {
		// First try to find by exact name match (case-insensitive)
		const existing = await prisma.client.findFirst({
			where: { name: { equals: name }, deletedAt: null },
		});

		if (existing) {
			return existing;
		}

		// Create new client
		return this.createClient({ name, createdBy });
	}

	/**
	 * Search clients for autocomplete
	 */
	async searchClients(search: string, limit: number = 10) {
		return prisma.client.findMany({
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
export const clientService = new ClientService();
