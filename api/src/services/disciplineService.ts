import { prisma } from "../config/database";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { Status } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateDisciplineData {
	name: string;
	status?: Status;
	createdBy?: number;
}

export interface UpdateDisciplineData {
	name?: string;
	slug?: string;
	status?: Status;
}

export interface GetDisciplinesQuery {
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
// DISCIPLINE SERVICE
// ============================================

export class DisciplineService {
	async getDisciplines(query: GetDisciplinesQuery = {}) {
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

		const [disciplines, total] = await Promise.all([
			prisma.discipline.findMany({
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
			prisma.discipline.count({ where }),
		]);

		return {
			disciplines,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getAllDisciplines(query: { search?: string; limit?: number } = {}) {
		const { search, limit } = query;

		const where: any = {
			deletedAt: null,
		};

		if (search) {
			where.name = { contains: search };
		}

		return prisma.discipline.findMany({
			where,
			orderBy: { name: "asc" },
			take: limit,
		});
	}

	async getDisciplineById(id: number) {
		return prisma.discipline.findUnique({
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

	async getDisciplineBySlug(slug: string) {
		return prisma.discipline.findUnique({
			where: { slug },
		});
	}

	async createDiscipline(data: CreateDisciplineData) {
		const baseSlug = slugify(data.name);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.discipline.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		return prisma.discipline.create({
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

	async updateDiscipline(id: number, data: UpdateDisciplineData) {
		const updateData: any = { ...data };

		if (data.name && !data.slug) {
			const baseSlug = slugify(data.name);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.discipline.findFirst({
					where: { slug: s, id: { not: id } },
				});
				return !!existing;
			});
		}

		return prisma.discipline.update({
			where: { id },
			data: updateData,
			include: {
				creator: { select: { id: true, name: true } },
			},
		});
	}

	async deleteDiscipline(id: number) {
		return prisma.discipline.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	}

	async restoreDiscipline(id: number) {
		return prisma.discipline.update({
			where: { id },
			data: { deletedAt: null },
		});
	}

	async purgeDiscipline(id: number) {
		return prisma.discipline.delete({
			where: { id },
		});
	}

	async bulkDeleteDisciplines(ids: number[]) {
		return prisma.discipline.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: new Date() },
		});
	}

	async bulkPurgeDisciplines(ids: number[]) {
		return prisma.discipline.deleteMany({
			where: { id: { in: ids } },
		});
	}

	async publishDiscipline(id: number) {
		return prisma.discipline.update({
			where: { id },
			data: { status: "PUBLISHED" },
		});
	}

	async unpublishDiscipline(id: number) {
		return prisma.discipline.update({
			where: { id },
			data: { status: "DRAFT" },
		});
	}

	async getTrashedDisciplines(query: GetDisciplinesQuery = {}) {
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

		const [disciplines, total] = await Promise.all([
			prisma.discipline.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				include: {
					creator: { select: { id: true, name: true } },
				},
			}),
			prisma.discipline.count({ where }),
		]);

		return {
			disciplines,
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
			prisma.discipline.count({ where: { deletedAt: null } }),
			prisma.discipline.count({ where: { deletedAt: null, status: "DRAFT" } }),
			prisma.discipline.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
			prisma.discipline.count({ where: { deletedAt: { not: null }, purgedAt: null } }),
		]);

		return { all, draft, published, trashed };
	}

	async findOrCreateDiscipline(name: string, createdBy?: number) {
		const existing = await prisma.discipline.findFirst({
			where: { name: { equals: name }, deletedAt: null },
		});

		if (existing) {
			return existing;
		}

		return this.createDiscipline({ name, createdBy });
	}

	async searchDisciplines(search: string, limit: number = 10) {
		return prisma.discipline.findMany({
			where: {
				name: { contains: search },
				deletedAt: null,
			},
			orderBy: { name: "asc" },
			take: limit,
		});
	}
}

export const disciplineService = new DisciplineService();
