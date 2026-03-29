import { prisma } from "../config/database";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { Status } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateSectorData {
	name: string;
	status?: Status;
	createdBy?: number;
}

export interface UpdateSectorData {
	name?: string;
	slug?: string;
	status?: Status;
}

export interface GetSectorsQuery {
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
// SECTOR SERVICE
// ============================================

export class SectorService {
	async getSectors(query: GetSectorsQuery = {}) {
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

		const [sectors, total] = await Promise.all([
			prisma.sector.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
					_count: {
						select: {
							works: true,
						},
					},
				},
			}),
			prisma.sector.count({ where }),
		]);

		return {
			sectors,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getAllSectors(query: { search?: string; limit?: number } = {}) {
		const { search, limit } = query;

		const where: any = {
			deletedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		return prisma.sector.findMany({
			where,
			orderBy: { name: "asc" },
			take: limit,
		});
	}

	async getSectorById(id: number) {
		return prisma.sector.findUnique({
			where: { id },
			include: {
				creator: { select: { id: true, name: true } },
				_count: {
					select: {
						works: true,
					},
				},
			},
		});
	}

	async getSectorBySlug(slug: string) {
		return prisma.sector.findUnique({
			where: { slug },
		});
	}

	async createSector(data: CreateSectorData) {
		const baseSlug = slugify(data.name);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.sector.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		return prisma.sector.create({
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

	async updateSector(id: number, data: UpdateSectorData) {
		const updateData: any = { ...data };

		if (data.name && !data.slug) {
			const baseSlug = slugify(data.name);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.sector.findFirst({
					where: { slug: s, id: { not: id } },
				});
				return !!existing;
			});
		}

		return prisma.sector.update({
			where: { id },
			data: updateData,
			include: {
				creator: { select: { id: true, name: true } },
			},
		});
	}

	async deleteSector(id: number) {
		return prisma.sector.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	}

	async restoreSector(id: number) {
		return prisma.sector.update({
			where: { id },
			data: { deletedAt: null },
		});
	}

	async purgeSector(id: number) {
		return prisma.sector.delete({
			where: { id },
		});
	}

	async bulkDeleteSectors(ids: number[]) {
		return prisma.sector.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: new Date() },
		});
	}

	async bulkPurgeSectors(ids: number[]) {
		return prisma.sector.deleteMany({
			where: { id: { in: ids } },
		});
	}

	async publishSector(id: number) {
		return prisma.sector.update({
			where: { id },
			data: { status: "PUBLISHED" },
		});
	}

	async unpublishSector(id: number) {
		return prisma.sector.update({
			where: { id },
			data: { status: "DRAFT" },
		});
	}

	async getTrashedSectors(query: GetSectorsQuery = {}) {
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

		const [sectors, total] = await Promise.all([
			prisma.sector.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
				},
			}),
			prisma.sector.count({ where }),
		]);

		return {
			sectors,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getCounts() {
		const [all, draft, published, trashed] = await Promise.all([
			prisma.sector.count({ where: { deletedAt: null } }),
			prisma.sector.count({ where: { deletedAt: null, status: "DRAFT" } }),
			prisma.sector.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
			prisma.sector.count({ where: { deletedAt: { not: null }, purgedAt: null } }),
		]);

		return { all, draft, published, trashed };
	}

	async findOrCreateSector(name: string, createdBy?: number) {
		const existing = await prisma.sector.findFirst({
			where: { name: { equals: name }, deletedAt: null },
		});

		if (existing) {
			return existing;
		}

		return this.createSector({ name, createdBy });
	}

	async searchSectors(search: string, limit: number = 10) {
		return prisma.sector.findMany({
			where: {
				name: { contains: search },
				deletedAt: null,
			},
			orderBy: { name: "asc" },
			take: limit,
		});
	}
}

export const sectorService = new SectorService();
