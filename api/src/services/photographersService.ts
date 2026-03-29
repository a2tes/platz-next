import { prisma } from "../config/database";
import { serializeMediaFile } from "../utils/serialization";
import { slugify, generateUniqueSlug } from "../utils/slugify";

function serializePhotographer(photographer: any) {
	if (!photographer) return photographer;
	return {
		...photographer,
		avatar: serializeMediaFile(photographer.avatar),
		coverImage: serializeMediaFile(photographer.coverImage),
		previewImage: serializeMediaFile(photographer.previewImage),
	};
}

export interface CreatePhotographerData {
	title: string;
	bio?: string;
	avatarId?: number | null;
	coverImageId?: number | null;
	groupByClient?: boolean;
	tags?: any[];
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number | null;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdatePhotographerData {
	title?: string;
	bio?: string;
	avatarId?: number | null;
	coverImageId?: number | null;
	groupByClient?: boolean;
	tags?: any[];
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number | null;
	status?: "DRAFT" | "PUBLISHED";
}

export interface GetPhotographersQuery {
	page: number;
	limit: number;
	search?: string;
	sortBy: "title" | "createdAt" | "updatedAt";
	sortOrder: "asc" | "desc";
	mine?: boolean;
	status?: "DRAFT" | "PUBLISHED";
}

export interface GetPhotographersOptions {
	includeTrashed?: boolean;
	includePurged?: boolean;
	currentUserId?: number;
}

export class PhotographersService {
	async create(data: CreatePhotographerData) {
		// Generate slug from title
		const baseSlug = slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.photographer.findFirst({
				where: { slug: s },
			});
			return !!existing;
		});

		const photographer = await prisma.photographer.create({
			data: { ...data, slug, bio: data.bio || null } as any,
			include: {
				avatar: true,
				coverImage: true,
				previewImage: true,
				creator: true,
			} as any,
		});

		return serializePhotographer(photographer);
	}

	async list(query: GetPhotographersQuery, options: GetPhotographersOptions = {}) {
		const { page, limit, search, sortBy, sortOrder, mine, status } = query;
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

		// Mine scope: only photographers created by current user
		if (mine && options.currentUserId) {
			where.createdBy = options.currentUserId;
		}

		// Status filter
		if (status) {
			where.status = status;
		}

		if (search) {
			where.OR = [{ title: { contains: search } }, { bio: { contains: search } }];
		}

		// Always order by sortOrder first, then requested sort
		const orderBy: any = [{ sortOrder: "asc" } as any, { [sortBy]: sortOrder }];

		const [items, total] = await Promise.all([
			prisma.photographer.findMany({
				where,
				include: {
					avatar: true,
					coverImage: true,
					previewImage: true,
					creator: true,
				} as any,
				orderBy,
				skip,
				take: limit,
			}) as any,
			prisma.photographer.count({ where }) as any,
		]);

		const photographerIds = items.map((item: any) => item.id);
		const countsMap = new Map<number, { total: number; active: number }>();
		if (photographerIds.length) {
			const grouped = await prisma.photography.groupBy({
				by: ["photographerId", "status"],
				where: {
					photographerId: { in: photographerIds },
					purgedAt: null,
					deletedAt: null,
				},
				_count: { _all: true },
			});
			for (const row of grouped) {
				const current = countsMap.get(row.photographerId) ?? {
					total: 0,
					active: 0,
				};
				countsMap.set(row.photographerId, {
					total: current.total + row._count._all,
					active: current.active + (row.status === "PUBLISHED" ? row._count._all : 0),
				});
			}
		}

		const photographers = items.map((item: any) => {
			const serialized = serializePhotographer(item);
			const counts = countsMap.get(item.id) ?? { total: 0, active: 0 };
			return {
				...serialized,
				imagesCount: counts.total,
				activeImagesCount: counts.active,
			};
		});

		return {
			photographers,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	async reorder(orderedIds: number[]) {
		await prisma.$transaction(
			orderedIds.map((id, index) =>
				prisma.photographer.update({
					where: { id },
					data: { sortOrder: index },
				}),
			),
		);
		return { message: "Reordered" };
	}

	async getById(id: number, options: { includeTrashed?: boolean; includePurged?: boolean } = {}) {
		const item = await prisma.photographer.findFirst({
			where: {
				id,
				...(options.includePurged ? {} : { purgedAt: null }),
				...(options.includeTrashed ? {} : { deletedAt: null }),
			},
			include: {
				avatar: true,
				coverImage: true,
				previewImage: true,
				creator: true,
			} as any,
		});
		return serializePhotographer(item);
	}

	async updateTitle(id: number, title: string) {
		// Get current photographer
		const currentPhotographer = await prisma.photographer.findUnique({
			where: { id },
		});

		if (!currentPhotographer) {
			throw new Error("Photographer not found");
		}

		// Generate new slug from title
		const baseSlug = slugify(title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.photographer.findFirst({
				where: { slug: s },
			});
			return existing ? existing.id !== id : false;
		});

		// Update photographer
		const photographer = await prisma.photographer.update({
			where: { id },
			data: { title, slug },
			include: {
				avatar: true,
				coverImage: true,
				previewImage: true,
				creator: true,
			} as any,
		});

		return serializePhotographer(photographer);
	}

	async update(id: number, data: UpdatePhotographerData) {
		const updateData: any = { ...data };

		// Sanitize bio: empty string → null (DB CHECK constraint rejects empty strings)
		if (updateData.bio !== undefined && !updateData.bio) {
			updateData.bio = null;
		}

		// If title is being updated, regenerate slug
		if (data.title) {
			const baseSlug = slugify(data.title);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.photographer.findFirst({
					where: {
						slug: s,
						id: { not: id },
					},
				});
				return !!existing;
			});
		}

		const photographer = await prisma.photographer.update({
			where: { id },
			data: updateData,
			include: {
				avatar: true,
				coverImage: true,
				previewImage: true,
				creator: true,
			} as any,
		});
		return serializePhotographer(photographer);
	}
	async delete(id: number) {
		const usage = await prisma.photography.count({
			where: { photographerId: id },
		});
		if (usage > 0) throw new Error("Cannot delete photographer that is associated with photography items");
		return prisma.photographer.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	async trash(id: number) {
		return prisma.photographer.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	async restore(id: number) {
		return prisma.photographer.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	async purge(id: number) {
		return prisma.photographer.update({
			where: { id },
			data: { purgedAt: new Date() } as any,
		});
	}

	async getFilterCounts(userId?: number) {
		const baseWhere = { purgedAt: null } as any;
		const nonTrashed = { ...baseWhere, deletedAt: null } as any;
		const trashed = { ...baseWhere, deletedAt: { not: null } } as any;

		const [all, mine, published, draft, trash] = await Promise.all([
			prisma.photographer.count({ where: nonTrashed }),
			userId
				? prisma.photographer.count({
						where: { ...nonTrashed, createdBy: userId },
					})
				: Promise.resolve(0),
			prisma.photographer.count({
				where: { ...nonTrashed, status: "PUBLISHED" },
			}),
			prisma.photographer.count({
				where: { ...nonTrashed, status: "DRAFT" },
			}),
			prisma.photographer.count({ where: trashed }),
		]);
		return { all, mine, published, draft, trash };
	}

	async publish(id: number) {
		return prisma.photographer.update({
			where: { id },
			data: { status: "PUBLISHED", publishedAt: new Date() } as any,
		});
	}

	async unpublish(id: number) {
		return prisma.photographer.update({
			where: { id },
			data: { status: "DRAFT", publishedAt: null } as any,
		});
	}

	async bulkDeletePhotographers(ids: number[]) {
		if (!ids.length)
			return {
				deleted: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Photographers used by any photography items
		const used = await prisma.photography.findMany({
			where: { photographerId: { in: ids }, purgedAt: null },
			select: { photographerId: true },
			distinct: ["photographerId"],
		});
		const usedIds = new Set(used.map((u) => u.photographerId!).filter((v) => v != null));

		const deletable = await prisma.photographer.findMany({
			where: {
				id: { in: ids.filter((id) => !usedIds.has(id)) },
				purgedAt: null,
			},
			select: { id: true, title: true },
		});
		const validIds = deletable.map((d) => d.id);

		if (validIds.length) {
			await prisma.photographer.updateMany({
				where: { id: { in: validIds } },
				data: { deletedAt: new Date() } as any,
			});
		}

		const skipped: Array<{ id: number; reason: string }> = [];
		for (const id of ids) {
			if (usedIds.has(id))
				skipped.push({
					id,
					reason: "Photographer is used by photography items",
				});
			else if (!validIds.includes(id)) skipped.push({ id, reason: "Not found or already deleted" });
		}

		return { deleted: deletable, skipped };
	}

	async bulkPurgePhotographers(ids: number[]) {
		if (!ids.length)
			return {
				purged: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		const existing = await prisma.photographer.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: { id: true, title: true },
		});
		const validIds = existing.map((d) => d.id);

		if (validIds.length) {
			await prisma.photographer.updateMany({
				where: { id: { in: validIds } },
				data: { purgedAt: new Date() } as any,
			});
		}

		const skipped = ids
			.filter((id) => !validIds.includes(id))
			.map((id) => ({ id, reason: "Not found or already deleted" }));

		return { purged: existing, skipped };
	}

	async bulkPublishPhotographers(ids: number[]) {
		if (!ids.length)
			return {
				published: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		const existing = await prisma.photographer.findMany({
			where: { id: { in: ids }, purgedAt: null, deletedAt: null },
			select: { id: true, title: true },
		});
		const validIds = existing.map((d) => d.id);

		if (validIds.length) {
			await prisma.photographer.updateMany({
				where: { id: { in: validIds } },
				data: { status: "PUBLISHED", publishedAt: new Date() } as any,
			});
		}

		const skipped = ids
			.filter((id) => !validIds.includes(id))
			.map((id) => ({ id, reason: "Not found, trashed or deleted" }));

		return { published: existing, skipped };
	}

	async bulkUnpublishPhotographers(ids: number[]) {
		if (!ids.length)
			return {
				unpublished: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		const existing = await prisma.photographer.findMany({
			where: { id: { in: ids }, purgedAt: null, deletedAt: null },
			select: { id: true, title: true },
		});
		const validIds = existing.map((d) => d.id);

		if (validIds.length) {
			await prisma.photographer.updateMany({
				where: { id: { in: validIds } },
				data: { status: "DRAFT", publishedAt: null } as any,
			});
		}

		const skipped = ids
			.filter((id) => !validIds.includes(id))
			.map((id) => ({ id, reason: "Not found, trashed or deleted" }));

		return { unpublished: existing, skipped };
	}
}

export const photographersService = new PhotographersService();
