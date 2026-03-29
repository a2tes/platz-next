import { prisma } from "../config/database";
import slugify from "slugify";

export interface StarringData {
	name: string;
}

export const starringService = {
	async getAll(search?: string, limit?: number) {
		const where: Record<string, unknown> = {
			deletedAt: null,
		};

		if (search) {
			where.title = {
				contains: search,
			};
		}

		return prisma.starring.findMany({
			where,
			take: limit,
			orderBy: { title: "asc" },
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	},

	async search(query: string, limit: number = 10) {
		return prisma.starring.findMany({
			where: {
				deletedAt: null,
				title: {
					contains: query,
				},
			},
			take: limit,
			orderBy: { title: "asc" },
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	},

	async getById(id: number) {
		return prisma.starring.findUnique({
			where: { id },
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	},

	async create(data: StarringData) {
		const slug = slugify(data.name, { lower: true, strict: true });

		return prisma.starring.create({
			data: {
				title: data.name,
				slug,
			},
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	},

	async findOrCreate(name: string) {
		const slug = slugify(name, { lower: true, strict: true });

		// Try to find existing
		const existing = await prisma.starring.findFirst({
			where: {
				OR: [{ slug }, { title: name }],
				deletedAt: null,
			},
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (existing) {
			return existing;
		}

		// Create new
		return prisma.starring.create({
			data: {
				title: name,
				slug,
			},
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	},

	async update(id: number, data: Partial<StarringData>) {
		const updateData: Record<string, unknown> = {};

		if (data.name) {
			updateData.title = data.name;
			updateData.slug = slugify(data.name, { lower: true, strict: true });
		}

		return prisma.starring.update({
			where: { id },
			data: updateData,
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	},

	async delete(id: number) {
		return prisma.starring.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	},
};
