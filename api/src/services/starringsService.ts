import { prisma } from "../config/database";
import { serializeMediaFile } from "../utils/serialization";
import { slugify, generateUniqueSlug } from "../utils/slugify";

/**
 * Serialize Starring objects with avatar MediaFile
 */
function serializeStarring(starring: any) {
	if (!starring) return starring;

	return {
		...starring,
		avatar: serializeMediaFile(starring.avatar),
		creator: starring.creator
			? {
					id: starring.creator.id,
					name: starring.creator.name,
					email: starring.creator.email,
				}
			: null,
	};
}

export interface CreateStarringData {
	title: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	avatarId?: number;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdateStarringData {
	title?: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	avatarId?: number;
}

export interface GetStarringsQuery {
	page: number;
	limit: number;
	search?: string;
	sortBy: "title" | "createdAt" | "updatedAt";
	sortOrder: "asc" | "desc";
	status?: "DRAFT" | "PUBLISHED";
	mine?: boolean;
	trash?: boolean;
}

export class StarringsService {
	/**
	 * Create a new starring
	 */
	async createStarring(data: CreateStarringData, options: { currentUserId?: number } = {}) {
		// Generate unique slug
		const baseSlug = data.slug ? slugify(data.slug) : slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.starring.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		const createData: any = {
			title: data.title,
			slug,
			...(data.shortDescription !== undefined && {
				shortDescription: data.shortDescription,
			}),
			...(data.biography !== undefined && { biography: data.biography }),
			...(data.avatarId !== undefined && { avatarId: data.avatarId }),
			...(data.status !== undefined && { status: data.status }),
			...(options.currentUserId !== undefined && {
				createdBy: options.currentUserId,
			}),
		};

		const starring = await prisma.starring.create({
			data: createData,
			include: {
				avatar: true,
				creator: true,
				works: {
					where: {
						work: {
							deletedAt: null,
							purgedAt: null,
						},
					},
					include: {
						work: {
							select: {
								id: true,
								title: true,
								status: true,
							},
						},
					},
				},
			},
		});

		return serializeStarring(starring);
	}

	/**
	 * Get starrings with pagination and filtering
	 */
	async getStarrings(query: GetStarringsQuery, options: { currentUserId?: number } = {}) {
		const { page, limit, search, sortBy, sortOrder, status, mine, trash } = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = {
			purgedAt: null,
			...(trash ? { deletedAt: { not: null } } : { deletedAt: null }),
		} as any;

		if (search) {
			where.OR = [
				{ title: { contains: search } },
				{ shortDescription: { contains: search } },
				{ biography: { contains: search } },
			];
		}

		if (status) {
			where.status = status;
		}

		if (mine && options.currentUserId) {
			where.createdBy = options.currentUserId;
		}

		// Build order by clause
		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [starrings, total] = await Promise.all([
			prisma.starring.findMany({
				where,
				include: {
					avatar: true,
					creator: true,
					_count: {
						select: {
							works: true,
							photography: true,
						},
					},
				},
				orderBy,
				skip,
				take: limit,
			}),
			prisma.starring.count({ where }),
		]);

		return {
			starrings: starrings.map(serializeStarring),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get starring by ID
	 */
	async getStarringById(id: number, options: { includeTrashed?: boolean; includePurged?: boolean } = {}) {
		const starring = await prisma.starring.findFirst({
			where: {
				id,
				...(options.includePurged ? {} : { purgedAt: null }),
				...(options.includeTrashed ? {} : { deletedAt: null }),
			},
			include: {
				avatar: true,
				creator: true,
				works: {
					where: {
						work: {
							deletedAt: null,
							purgedAt: null,
						},
					},
					include: {
						work: {
							include: {
								videoFile: true,
							},
						},
					},
				},
			},
		});

		return serializeStarring(starring);
	}

	/**
	 * Update starring
	 */
	async updateStarring(id: number, data: UpdateStarringData) {
		// Generate unique slug if title is being updated
		const updateData: any = { ...data };
		if (data.slug) {
			const baseSlug = slugify(data.slug);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.starring.findFirst({
					where: {
						slug: s,
						id: { not: id }, // Exclude current starring
					},
				});
				return !!existing;
			});
		} else if (data.title) {
			const baseSlug = slugify(data.title);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.starring.findFirst({
					where: {
						slug: s,
						id: { not: id }, // Exclude current starring
					},
				});
				return !!existing;
			});
		}

		const starring = await prisma.starring.update({
			where: { id },
			data: updateData,
			include: {
				avatar: true,
				works: {
					where: {
						work: {
							deletedAt: null,
							purgedAt: null,
						},
					},
					include: {
						work: {
							select: {
								id: true,
								title: true,
								status: true,
							},
						},
					},
				},
			},
		});

		return serializeStarring(starring);
	}

	/**
	 * Delete starring
	 */
	async deleteStarring(id: number) {
		// Get starring info
		const starring = await prisma.starring.findUnique({
			where: { id },
			select: { title: true },
		});

		if (!starring) {
			throw new Error("Starring not found");
		}

		// Check if starring is used in any works
		const worksCount = await prisma.workStarring.count({
			where: { starringId: id },
		});

		if (worksCount > 0) {
			throw new Error(
				`Cannot delete "${starring.title}". This starring is associated with ${worksCount} work${
					worksCount === 1 ? "" : "s"
				}`,
			);
		}

		return prisma.starring.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	/** Move starring to trash */
	async trashStarring(id: number) {
		return prisma.starring.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	/** Restore starring from trash */
	async restoreStarring(id: number) {
		return prisma.starring.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	/** Purge starring from UI */
	async purgeStarring(id: number) {
		return prisma.starring.update({
			where: { id },
			data: { purgedAt: new Date() } as any,
		});
	}

	/**
	 * Bulk delete starrings (move to Trash) with usage check
	 */
	async bulkDeleteStarrings(ids: number[]) {
		if (!ids.length)
			return {
				deleted: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Find starrings that are referenced by any works
		const used = await prisma.workStarring.findMany({
			where: { starringId: { in: ids } },
			select: { starringId: true },
			distinct: ["starringId"],
		});
		const usedIds = new Set(used.map((u) => u.starringId));

		// Only delete those not used and not already purged
		const deletable = await prisma.starring.findMany({
			where: {
				id: { in: ids.filter((id) => !usedIds.has(id)) },
				purgedAt: null,
			},
			select: { id: true, title: true },
		});
		const validIds = deletable.map((d) => d.id);

		if (validIds.length) {
			await prisma.starring.updateMany({
				where: { id: { in: validIds } },
				data: { deletedAt: new Date() } as any,
			});
		}

		const skipped: Array<{ id: number; reason: string }> = [];
		for (const id of ids) {
			if (usedIds.has(id)) skipped.push({ id, reason: "Starring is used by works" });
			else if (!validIds.includes(id)) skipped.push({ id, reason: "Not found or already deleted" });
		}

		return { deleted: deletable, skipped };
	}

	/**
	 * Bulk purge starrings
	 */
	async bulkPurgeStarrings(ids: number[]) {
		if (!ids.length)
			return {
				purged: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		const existing = await prisma.starring.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: { id: true, title: true },
		});
		const validIds = existing.map((d) => d.id);

		if (validIds.length) {
			await prisma.starring.updateMany({
				where: { id: { in: validIds } },
				data: { purgedAt: new Date() } as any,
			});
		}

		const skipped = ids
			.filter((id) => !validIds.includes(id))
			.map((id) => ({ id, reason: "Not found or already deleted" }));

		return { purged: existing, skipped };
	}

	/** List trashed starrings */
	async getTrashedStarrings(query: GetStarringsQuery) {
		const { page, limit, search, sortBy, sortOrder } = query;
		const skip = (page - 1) * limit;
		const where: any = { purgedAt: null, deletedAt: { not: null } } as any;
		if (search) {
			where.OR = [
				{ title: { contains: search } },
				{ shortDescription: { contains: search } },
				{ biography: { contains: search } },
			];
		}
		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;
		const [starrings, total] = await Promise.all([
			prisma.starring.findMany({
				where,
				include: {
					avatar: true,
					works: {
						where: {
							work: {
								deletedAt: null,
								purgedAt: null,
							},
						},
						include: {
							work: { select: { id: true, title: true, status: true } },
						},
					},
				},
				orderBy,
				skip,
				take: limit,
			}),
			prisma.starring.count({ where }),
		]);
		return {
			starrings: starrings.map(serializeStarring),
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	async getFilterCounts(userId?: number) {
		const baseWhere = { purgedAt: null } as any;
		const nonTrashed = { ...baseWhere, deletedAt: null } as any;
		const trashed = { ...baseWhere, deletedAt: { not: null } } as any;

		const [all, mine, published, draft, trash] = await Promise.all([
			prisma.starring.count({ where: nonTrashed }),
			userId
				? prisma.starring.count({
						where: { ...nonTrashed, createdBy: userId },
					})
				: Promise.resolve(0),
			prisma.starring.count({
				where: { ...nonTrashed, status: "PUBLISHED" },
			}),
			prisma.starring.count({
				where: { ...nonTrashed, status: "DRAFT" },
			}),
			prisma.starring.count({ where: trashed }),
		]);
		return { all, mine, published, draft, trash };
	}

	/** Publish / Unpublish */
	async publishStarring(id: number) {
		return prisma.starring.update({
			where: { id },
			data: { status: "PUBLISHED" as any, publishedAt: new Date() } as any,
		});
	}
	async unpublishStarring(id: number) {
		return prisma.starring.update({
			where: { id },
			data: { status: "DRAFT" as any, publishedAt: null } as any,
		});
	}

	/**
	 * Get starrings statistics
	 */
	async getStarringsStats() {
		const [total, withWorks, withoutWorks] = await Promise.all([
			prisma.starring.count(),
			prisma.starring.count({
				where: {
					works: {
						some: {},
					},
				},
			}),
			prisma.starring.count({
				where: {
					works: {
						none: {},
					},
				},
			}),
		]);

		return {
			total,
			withWorks,
			withoutWorks,
		};
	}

	/**
	 * Get all starrings for selection (simplified data)
	 */
	async getStarringsForSelection() {
		return prisma.starring.findMany({
			where: { deletedAt: null, purgedAt: null } as any,
			select: {
				id: true,
				title: true,
				avatar: {
					select: {
						id: true,
						filename: true,
					},
				},
			},
			orderBy: {
				title: "asc",
			},
		});
	}
}

export const starringsService = new StarringsService();
