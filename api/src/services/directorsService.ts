import { prisma } from "../config/database";
import { serializeMediaFile } from "../utils/serialization";
import { slugify, generateUniqueSlug } from "../utils/slugify";

/**
 * Serialize Director objects with avatar MediaFile
 */
function serializeDirector(director: any) {
	if (!director) return director;

	return {
		...director,
		avatar: serializeMediaFile(director.avatar),
		// Ensure nested media under works are serialized to avoid BigInt issues
		works: director.works?.map((wd: any) => ({
			...wd,
			work: wd.work
				? {
						...wd.work,
						videoFile: serializeMediaFile(wd.work.videoFile),
					}
				: wd.work,
		})),
	};
}

export interface CreateDirectorData {
	title: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	links?: Array<{ title: string; url: string }>;
	avatarId?: number;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
}

export interface UpdateDirectorData {
	title?: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	links?: Array<{ title: string; url: string }>;
	avatarId?: number;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
}

export interface GetDirectorsQuery {
	page: number;
	limit: number;
	search?: string;
	sortBy: "title" | "createdAt" | "updatedAt";
	sortOrder: "asc" | "desc";
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED" | "ALL";
	mine?: boolean;
}

export class DirectorsService {
	/**
	 * Create a new director
	 */
	async createDirector(data: CreateDirectorData, options: { currentUserId?: number } = {}) {
		// Generate unique slug
		const baseSlug = data.slug ? slugify(data.slug) : slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.director.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		const director = await prisma.director.create({
			data: {
				...data,
				slug,
				// set createdBy if available
				createdBy: options.currentUserId ?? undefined,
			} as any,
			include: {
				avatar: true,
				creator: { select: { id: true, name: true, email: true } },
				works: {
					where: {
						work: {
							deletedAt: null,
							purgedAt: null,
						},
					},
					// Nested order by pivot column is not supported here; use separate fetch when needed
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
			} as any,
		});

		return serializeDirector(director);
	}

	/**
	 * Get directors with pagination and filtering
	 */
	async getDirectors(query: GetDirectorsQuery, options: { currentUserId?: number } = {}) {
		const { page, limit, search, sortBy, sortOrder, status, mine } = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = { deletedAt: null, purgedAt: null } as any;
		if (mine && options.currentUserId) {
			where.createdBy = options.currentUserId;
		}
		if (status && status !== "ALL") {
			where.status = status;
		}

		if (search) {
			where.OR = [
				{ title: { contains: search } },
				{ shortDescription: { contains: search } },
				{ biography: { contains: search } },
			];
		}

		// Build order by clause
		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [directors, total] = await Promise.all([
			prisma.director.findMany({
				where,
				include: {
					avatar: true,
					creator: { select: { id: true, name: true, email: true } },
					works: {
						where: {
							work: {
								deletedAt: null,
								purgedAt: null,
							},
						},
						// Cannot order inside relation by new join column (Prisma limitation for m-n pivot without explicit model ordering input).
						// We'll remove this and rely on separate endpoint for ordered works.
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
				} as any,
				orderBy,
				skip,
				take: limit,
			}),
			prisma.director.count({ where }),
		]);

		return {
			directors: directors.map(serializeDirector),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get director by ID
	 */
	async getDirectorById(id: number, options: { includeTrashed?: boolean; includePurged?: boolean } = {}) {
		const director = await prisma.director.findFirst({
			where: {
				id,
				...(options.includePurged ? {} : { purgedAt: null }),
				...(options.includeTrashed ? {} : { deletedAt: null }),
			},
			include: {
				avatar: true,
				creator: { select: { id: true, name: true, email: true } },
				works: {
					where: {
						work: {
							deletedAt: null,
							purgedAt: null,
						},
					},
					// Nested order removed; ordering handled in getDirectorWorks
					include: {
						work: {
							include: {
								videoFile: true,
							},
						},
					},
				},
			} as any,
		});

		return serializeDirector(director);
	}

	/**
	 * Update director
	 */
	async updateDirector(id: number, data: UpdateDirectorData) {
		// Generate unique slug if title is being updated
		const updateData: any = { ...data };
		if (data.slug) {
			const baseSlug = slugify(data.slug);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.director.findFirst({
					where: {
						slug: s,
						id: { not: id }, // Exclude current director
					},
				});
				return !!existing;
			});
		} else if (data.title) {
			const baseSlug = slugify(data.title);
			updateData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.director.findFirst({
					where: {
						slug: s,
						id: { not: id }, // Exclude current director
					},
				});
				return !!existing;
			});
		}

		const director = await prisma.director.update({
			where: { id },
			data: updateData,
			include: {
				avatar: true,
				creator: { select: { id: true, name: true, email: true } },
				works: {
					where: {
						work: {
							deletedAt: null,
							purgedAt: null,
						},
					},
					// Ordering removed; use getDirectorWorks for ordered list
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
			} as any,
		});

		return serializeDirector(director);
	}

	/**
	 * Delete director
	 */
	async deleteDirector(id: number) {
		// Get director info
		const director = await prisma.director.findUnique({
			where: { id },
			select: { title: true },
		});

		if (!director) {
			throw new Error("Director not found");
		}

		// Check if director is used in any works
		const worksCount = await prisma.workDirector.count({
			where: { directorId: id },
		});

		if (worksCount > 0) {
			throw new Error(
				`Cannot delete "${director.title}". This director is associated with ${worksCount} work${
					worksCount === 1 ? "" : "s"
				}`,
			);
		}

		return prisma.director.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	/** Move director to trash */
	async trashDirector(id: number) {
		return prisma.director.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	/** Restore director from trash */
	async restoreDirector(id: number) {
		return prisma.director.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	/** Purge director from UI */
	async purgeDirector(id: number) {
		return prisma.director.update({
			where: { id },
			data: { purgedAt: new Date() } as any,
		});
	}

	/**
	 * Bulk delete directors (move to Trash) with usage check
	 */
	async bulkDeleteDirectors(ids: number[]) {
		if (!ids.length)
			return {
				deletedIds: [] as number[],
				deletedDirectors: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Find directors that are referenced by any works
		const used = await prisma.workDirector.findMany({
			where: { directorId: { in: ids } },
			select: { directorId: true },
			distinct: ["directorId"],
		});
		const usedIds = new Set(used.map((u) => u.directorId));

		// Only delete those not used and not already purged
		const deletable = await prisma.director.findMany({
			where: {
				id: { in: ids.filter((id) => !usedIds.has(id)) },
				purgedAt: null,
			},
			select: { id: true, title: true },
		});
		const validIds = deletable.map((d) => d.id);

		if (validIds.length) {
			await prisma.director.updateMany({
				where: { id: { in: validIds } },
				data: { deletedAt: new Date() } as any,
			});
		}

		const skipped: Array<{ id: number; reason: string }> = [];
		for (const id of ids) {
			if (usedIds.has(id)) skipped.push({ id, reason: "Director is used by works" });
			else if (!validIds.includes(id)) skipped.push({ id, reason: "Not found or already deleted" });
		}

		return { deletedIds: validIds, deletedDirectors: deletable, skipped };
	}

	/**
	 * Bulk purge directors
	 */
	async bulkPurgeDirectors(ids: number[]) {
		if (!ids.length)
			return {
				purgedIds: [] as number[],
				purgedDirectors: [] as Array<{ id: number; title: string }>,
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		const existing = await prisma.director.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: { id: true, title: true },
		});
		const validIds = existing.map((d) => d.id);

		if (validIds.length) {
			await prisma.director.updateMany({
				where: { id: { in: validIds } },
				data: { purgedAt: new Date() } as any,
			});
		}

		const skipped = ids
			.filter((id) => !validIds.includes(id))
			.map((id) => ({ id, reason: "Not found or already deleted" }));

		return { purgedIds: validIds, purgedDirectors: existing, skipped };
	}

	/** List trashed directors */
	async getTrashedDirectors(query: GetDirectorsQuery) {
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
		const [directors, total] = await Promise.all([
			prisma.director.findMany({
				where,
				include: {
					avatar: true,
					creator: { select: { id: true, name: true, email: true } },
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
				} as any,
				orderBy,
				skip,
				take: limit,
			}),
			prisma.director.count({ where }),
		]);
		return {
			directors: directors.map(serializeDirector),
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	/** Counts for filters */
	async getFilterCounts(userId?: number) {
		const baseWhere = { purgedAt: null } as any;
		const nonTrashed = { ...baseWhere, deletedAt: null } as any;
		const trashed = { ...baseWhere, deletedAt: { not: null } } as any;

		const [all, mine, published, draft, unlisted, trash] = await Promise.all([
			prisma.director.count({ where: nonTrashed }),
			userId
				? prisma.director.count({
						where: { ...nonTrashed, createdBy: userId },
					})
				: Promise.resolve(0),
			prisma.director.count({
				where: { ...nonTrashed, status: "PUBLISHED" },
			}),
			prisma.director.count({
				where: { ...nonTrashed, status: "DRAFT" },
			}),
			prisma.director.count({
				where: { ...nonTrashed, status: "UNLISTED" },
			}),
			prisma.director.count({ where: trashed }),
		]);
		return { all, mine, published, draft, unlisted, trash };
	}

	/** Publish / Unpublish */
	async publishDirector(id: number) {
		return prisma.director.update({
			where: { id },
			data: { status: "PUBLISHED" as any, publishedAt: new Date() } as any,
		});
	}
	async unpublishDirector(id: number) {
		return prisma.director.update({
			where: { id },
			data: { status: "DRAFT" as any, publishedAt: null } as any,
		});
	}

	/**
	 * Get directors statistics
	 */
	async getDirectorsStats() {
		const [total, withWorks, withoutWorks] = await Promise.all([
			prisma.director.count(),
			prisma.director.count({
				where: {
					works: {
						some: {},
					},
				},
			}),
			prisma.director.count({
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
	 * Get all directors for selection (simplified data)
	 */
	async getDirectorsForSelection() {
		return prisma.director.findMany({
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

	/** List works associated with a director ordered by WorkDirector.sortOrder */
	async getDirectorWorks(directorId: number) {
		// Ensure director exists (optional)
		const exists = await prisma.director.findUnique({
			where: { id: directorId },
		});
		if (!exists) return [];
		const links = (await prisma.workDirector.findMany({
			where: { directorId: directorId },
			orderBy: { sortOrder: "asc" } as any,
			include: {
				work: {
					select: {
						id: true,
						title: true,
						status: true,
						slug: true,
						videoFile: true,
						previewImage: true,
					},
				},
			},
		})) as any[];
		return links.map((l: any) => ({
			workId: l.workId,
			directorId: l.directorId,
			sortOrder: l.sortOrder,
			work: {
				...l.work,
				videoFile: serializeMediaFile(l.work.videoFile),
				previewImage: serializeMediaFile(l.work.previewImage),
			},
		}));
	}

	/** Reorder director's works */
	async reorderDirectorWorks(directorId: number, orderedWorkIds: number[]) {
		// Get current set
		const currentLinks = await prisma.workDirector.findMany({
			where: { directorId },
			select: { workId: true },
		});
		const currentIds = new Set(currentLinks.map((l) => l.workId));
		// Validate provided IDs match current set
		if (currentIds.size !== orderedWorkIds.length || orderedWorkIds.some((id) => !currentIds.has(id))) {
			throw new Error("Provided workIds do not match director's associated works");
		}
		await prisma.$transaction(
			orderedWorkIds.map((workId, index) =>
				prisma.workDirector.update({
					where: { workId_directorId: { workId, directorId } },
					data: { sortOrder: index + 1 } as any,
				}),
			),
		);
		return { message: "Reordered", count: orderedWorkIds.length };
	}

	/** Get paginated works for a director (for block editor content selector) */
	async getDirectorWorksPaginated(directorId: number, options: { page: number; limit: number; search: string }) {
		const { page, limit, search } = options;
		const skip = (page - 1) * limit;

		const where: any = { directorId };

		// If search is provided, filter by work title
		const workWhere: any = search ? { title: { contains: search } } : undefined;

		const [links, total] = await Promise.all([
			prisma.workDirector.findMany({
				where: workWhere ? { ...where, work: workWhere } : where,
				orderBy: { sortOrder: "asc" } as any,
				skip,
				take: limit,
				include: {
					work: {
						select: {
							id: true,
							title: true,
							status: true,
							slug: true,
							videoFile: true,
							previewImage: true,
						},
					},
				},
			}) as any,
			prisma.workDirector.count({
				where: workWhere ? { ...where, work: workWhere } : where,
			}),
		]);

		const works = links.map((l: any) => ({
			workId: l.workId,
			directorId: l.directorId,
			sortOrder: l.sortOrder,
			work: {
				...l.work,
				videoFile: serializeMediaFile(l.work.videoFile),
				previewImage: serializeMediaFile(l.work.previewImage),
			},
		}));

		return {
			works,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}
}

export const directorsService = new DirectorsService();
