import { prisma } from "../config/database";
import { Status, BlockType } from "@prisma/client";
import { serializeWork } from "../utils/serialization";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { revalidatePaths } from "./revalidateService";
import { clipProcessingService } from "./clipProcessingService";

// Helper function to remove null/undefined values from snapshot
function cleanSnapshot(snapshot: any): any {
	const cleaned: any = {};
	for (const [key, value] of Object.entries(snapshot)) {
		// Skip null and undefined values
		if (value === null || value === undefined) {
			continue;
		}
		// Skip empty strings
		if (value === "") {
			continue;
		}
		// Skip empty arrays
		if (Array.isArray(value) && value.length === 0) {
			continue;
		}
		cleaned[key] = value;
	}
	return cleaned;
}

export interface CreateWorkData {
	title: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string; // @deprecated
	tags: string[];
	videoFileId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number | null;
	status: Status;
	directorIds: number[];
	taxonomyIds?: number[];
}

export interface UpdateWorkData {
	title?: string;
	slug?: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string; // @deprecated
	tags?: string[];
	videoFileId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	previewImageId?: number | null;
	status?: Status;
	directorIds?: number[];
	taxonomyIds?: number[];
	publishedAt?: Date | null;
}

export interface GetWorksQuery {
	page: number;
	limit: number;
	search?: string;
	status: "DRAFT" | "PUBLISHED" | "ALL";
	sortBy: "title" | "client" | "createdAt" | "updatedAt" | "sortOrder";
	sortOrder: "asc" | "desc";
	mine?: boolean;
}

export interface GetWorksOptions {
	includeTrashed?: boolean; // include items in trash
	includePurged?: boolean; // include items purged (admin-only use)
	currentUserId?: number; // used when filtering mine
}

export class WorksService {
	/**
	 * Create a new work
	 */
	async createWork(data: CreateWorkData, userId?: number) {
		const { directorIds, taxonomyIds, ...workData } = data;

		// Generate unique slug
		const baseSlug = slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.work.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		// Get the next sort order
		const lastWork = await prisma.work.findFirst({
			orderBy: { sortOrder: "desc" },
		});
		const sortOrder = (lastWork?.sortOrder || 0) + 1;

		const work = await prisma.work.create({
			data: {
				...workData,
				shortDescription: workData.shortDescription ?? null,
				slug,
				sortOrder,
				publishedAt: workData.status === "PUBLISHED" ? new Date() : null,
				createdBy: userId,
				directors: {
					create: directorIds.map((directorId) => ({ directorId })),
				},
				taxonomies: taxonomyIds?.length
					? {
							create: taxonomyIds.map((taxonomyId) => ({ taxonomyId })),
						}
					: undefined,
			} as any,
			include: {
				videoFile: true,
				previewImage: true,
				creator: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				revisions: {
					orderBy: { createdAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				},
				directors: {
					include: {
						director: {
							include: {
								avatar: true,
							},
						},
					},
				},
				taxonomies: {
					include: {
						taxonomy: true,
					},
				},
			} as any,
		});

		// Create initial revision (V0 - baseline) if userId is provided
		// This will not be shown to users but used for comparison
		if (userId) {
			const rawSnapshot = {
				title: work.title,
				shortDescription: work.shortDescription,
				subtitle: work.subtitle,
				caseStudy: work.caseStudy,
				client: work.client,
				tags: work.tags || [],
				videoFileId: work.videoFileId,
				videoFileName: (work as any).videoFile?.originalName,
				metaDescription: work.metaDescription,
				metaKeywords: work.metaKeywords,
				previewImageId: (work as any).previewImageId,
				previewImageName: (work as any).previewImage?.originalName,
				status: work.status,
				sortOrder: work.sortOrder,
				publishedAt: work.publishedAt,
				directorIds: ((work as any).directors || []).map((wd: any) => wd.directorId),
				directorNames: ((work as any).directors || []).map((wd: any) => wd.director.title),
			};

			// Clean the snapshot to remove null/undefined/empty values
			const snapshot = cleanSnapshot(rawSnapshot);

			await prisma.workRevision.create({
				data: {
					workId: work.id,
					userId,
					version: 0,
					payload: snapshot as any,
				},
			});

			// Fetch work again with revisions included
			const workWithRevisions = await prisma.work.findUnique({
				where: { id: work.id },
				include: {
					videoFile: true,
					previewImage: true,
					revisions: {
						orderBy: { createdAt: "desc" },
						include: {
							user: {
								select: {
									id: true,
									name: true,
									email: true,
								},
							},
						},
					},
					directors: {
						include: {
							director: {
								include: {
									avatar: true,
								},
							},
						},
					},
				} as any,
			});

			return serializeWork(workWithRevisions);
		}

		return serializeWork(work);
	}

	/**
	 * Get works with pagination and filtering
	 */
	async getWorks(query: GetWorksQuery, options: GetWorksOptions = {}) {
		const { page, limit, search, status, sortBy, sortOrder, mine } = query;
		const skip = (page - 1) * limit;

		// Build where clause
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

		if (status !== "ALL") {
			where.status = status;
		}

		// Mine scope: only works created by current user (non-trashed, non-purged)
		if (mine && options.currentUserId) {
			where.createdBy = options.currentUserId;
		}

		if (search) {
			where.OR = [
				{ title: { contains: search } },
				{ shortDescription: { contains: search } },
				{ client: { contains: search } },
			];
		}

		// Build order by clause
		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [works, total] = await Promise.all([
			prisma.work.findMany({
				where,
				include: {
					videoFile: true,
					previewImage: true,
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					directors: {
						include: {
							director: {
								include: {
									avatar: true,
								},
							},
						},
					},
				} as any,
				orderBy,
				skip,
				take: limit,
			}),
			prisma.work.count({ where }),
		]);

		return {
			works: works.map(serializeWork),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get counts for Works filters: all, mine, published, draft, trash
	 */
	async getFilterCounts(userId: number) {
		const baseWhere = { purgedAt: null } as any;
		const nonTrashed = { ...baseWhere, deletedAt: null } as any;
		const trashed = { ...baseWhere, deletedAt: { not: null } } as any;

		const [all, mine, published, draft, trash] = await Promise.all([
			prisma.work.count({ where: nonTrashed }),
			prisma.work.count({ where: { ...nonTrashed, createdBy: userId } }),
			prisma.work.count({
				where: { ...nonTrashed, status: "PUBLISHED" as any },
			}),
			prisma.work.count({ where: { ...nonTrashed, status: "DRAFT" as any } }),
			prisma.work.count({ where: trashed }),
		]);

		return { all, mine, published, draft, trash };
	}

	/**
	 * Get work by ID
	 */
	async getWorkById(id: number, options: GetWorksOptions = {}) {
		const work = await prisma.work.findFirst({
			where: {
				id,
				...(options.includePurged ? {} : { purgedAt: null }),
				...(options.includeTrashed ? {} : { deletedAt: null }),
			},
			include: {
				videoFile: true,
				previewImage: true,
				revisions: {
					orderBy: { createdAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				},
				directors: {
					include: {
						director: {
							include: {
								avatar: true,
							},
						},
					},
				},
				taxonomies: {
					include: {
						taxonomy: true,
					},
				},
			} as any,
		});

		return serializeWork(work);
	}

	/**
	 * Update only work title (minor update, creates revision)
	 */
	async updateWorkTitle(id: number, title: string, userId?: number) {
		// Get current work
		const currentWork = await prisma.work.findUnique({
			where: { id },
			select: {
				title: true,
				shortDescription: true,
				subtitle: true,
				caseStudy: true,
				client: true,
				status: true,
				sortOrder: true,
				publishedAt: true,
			},
		});

		if (!currentWork) {
			throw new Error("Work not found");
		}

		// Generate new slug
		const baseSlug = slugify(title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.work.findUnique({
				where: { slug: s },
			});
			return existing ? existing.id !== id : false;
		});

		// Get the latest version number
		const latestRevision = await prisma.workRevision.findFirst({
			where: { workId: id },
			orderBy: { version: "desc" },
			select: { version: true },
		});

		const nextVersion = latestRevision ? latestRevision.version + 1 : 1;

		// Create revision with current data (snapshot before change)
		await prisma.workRevision.create({
			data: {
				workId: id,
				userId: userId || 1,
				version: nextVersion,
				payload: currentWork as any,
			},
		});

		// Update work title and slug
		const work = await prisma.work.update({
			where: { id },
			data: {
				title,
				slug,
			},
			include: {
				videoFile: true,
				previewImage: true,
				revisions: {
					orderBy: { createdAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				},
				directors: {
					include: {
						director: {
							include: {
								avatar: true,
							},
						},
					},
				},
			} as any,
		});

		return serializeWork(work);
	}

	/**
	 * Update work
	 */
	async updateWork(id: number, data: UpdateWorkData, userId?: number) {
		const { directorIds, taxonomyIds, ...workData } = data;

		// Get current work first to fetch existing revisions and current relations
		const currentWork = await prisma.work.findUnique({
			where: { id },
			include: {
				revisions: {
					orderBy: { createdAt: "desc" },
					take: 1,
				},
				directors: { select: { directorId: true } },
				taxonomies: { select: { taxonomyId: true } },
			},
		});

		if (!currentWork) {
			throw new Error("Work not found");
		}

		// If title is being updated, regenerate slug
		if (data.title && data.title !== currentWork.title) {
			const baseSlug = slugify(data.title);
			workData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.work.findUnique({
					where: { slug: s },
				});
				return existing ? existing.id !== id : false;
			});
		}

		// If status is being changed to PUBLISHED, set publishedAt
		if (workData.status === "PUBLISHED") {
			if (currentWork.status === "DRAFT") {
				workData.publishedAt = new Date();
			}
		}

		const work = await prisma.work.update({
			where: { id },
			data: {
				...workData,
				// Only update relations if explicitly provided (not undefined)
				// If directorIds is provided, update it (even if empty array - that's intentional)
				// If directorIds is undefined, keep existing relations
				...(directorIds !== undefined && {
					directors: {
						deleteMany: {},
						create: directorIds.map((directorId) => ({ directorId })),
					},
				}),
				...(taxonomyIds !== undefined && {
					taxonomies: {
						deleteMany: {},
						create: taxonomyIds.map((taxonomyId) => ({ taxonomyId })),
					},
				}),
			},
			include: {
				videoFile: true,
				previewImage: true,
				revisions: {
					orderBy: { createdAt: "desc" },
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				},
				directors: {
					include: {
						director: {
							include: {
								avatar: true,
							},
						},
					},
				},
				taxonomies: {
					include: {
						taxonomy: true,
					},
				},
			} as any,
		});

		// Create a revision record if userId is provided and there are actual changes
		if (userId) {
			let hasChanges = false;

			// Compare scalar fields provided in workData
			for (const [key, value] of Object.entries(workData)) {
				const currentValue = (currentWork as any)[key];
				let isChanged = false;
				if (Array.isArray(value) && Array.isArray(currentValue)) {
					isChanged = JSON.stringify(value) !== JSON.stringify(currentValue);
				} else {
					isChanged = value !== currentValue;
				}
				if (isChanged) {
					hasChanges = true;
					break;
				}
			}

			// Compare relation changes if provided
			if (!hasChanges && directorIds !== undefined) {
				const currentDirectorIds = (currentWork.directors || []).map((d) => d.directorId).sort((a, b) => a - b);
				const newDirectorIds = [...directorIds].sort((a, b) => a - b);
				if (JSON.stringify(currentDirectorIds) !== JSON.stringify(newDirectorIds)) {
					hasChanges = true;
				}
			}

			// Only create revision if there are actual changes
			if (hasChanges) {
				const nextVersion = (currentWork.revisions?.[0]?.version || 0) + 1;

				// Build snapshot payload from the updated work state
				const rawSnapshot = {
					title: work.title,
					shortDescription: work.shortDescription,
					subtitle: work.subtitle,
					caseStudy: work.caseStudy,
					client: work.client,
					tags: work.tags || [],
					videoFileId: work.videoFileId,
					videoFileName: (work as any).videoFile?.originalName,
					metaDescription: work.metaDescription,
					metaKeywords: work.metaKeywords,
					previewImageId: (work as any).previewImageId,
					previewImageName: (work as any).previewImage?.originalName,
					status: work.status,
					sortOrder: work.sortOrder,
					publishedAt: work.publishedAt,
					directorIds: ((work as any).directors || []).map((wd: any) => wd.directorId),
					directorNames: ((work as any).directors || []).map((wd: any) => wd.director.title),
				};

				// Clean the snapshot to remove null/undefined/empty values
				const snapshot = cleanSnapshot(rawSnapshot);

				await prisma.workRevision.create({
					data: {
						workId: id,
						userId,
						version: nextVersion,
						payload: snapshot as any,
					},
				});
			}
		}

		// Revalidate if status toggled publish/draft or slug changed
		try {
			const changedToPublished = workData.status === "PUBLISHED" && currentWork.status !== "PUBLISHED";
			const changedFromPublished = workData.status === "DRAFT" && currentWork.status === "PUBLISHED";
			const slugChanged = !!workData.slug && workData.slug !== currentWork.slug;
			if (changedToPublished || changedFromPublished || slugChanged) {
				const paths = new Set<string>(["/works", `/works/${work.slug}`]);
				if (slugChanged) paths.add(`/works/${currentWork.slug}`);
				await revalidatePaths(Array.from(paths));
			}
		} catch {}

		return serializeWork(work);
	}

	/**
	 * Delete work (move to trash)
	 * Directors and Cast relationships are preserved
	 */
	async deleteWork(id: number) {
		const work = await prisma.work.findUnique({
			where: { id },
			select: { id: true, title: true, status: true },
		});

		if (!work) {
			throw new Error(`Work with id ${id} not found`);
		}

		// Soft delete only - preserve all relationships
		// Directors and Cast will remain attached
		return prisma.work.update({
			where: { id },
			data: {
				deletedAt: new Date(),
				status: "DRAFT",
			} as any,
		});
	}

	/**
	 * Move work to trash
	 * Directors and Cast relationships are preserved
	 */
	async trashWork(id: number) {
		const work = await prisma.work.findUnique({
			where: { id },
			select: { id: true, title: true },
		});

		if (!work) {
			throw new Error(`Work with id ${id} not found`);
		}

		// Soft delete only - preserve all relationships
		// Directors and Cast will remain attached
		return prisma.work.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	/**
	 * Restore work from trash
	 */
	async restoreWork(id: number) {
		return prisma.work.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	/**
	 * Purge work (permanently hide from UI and detach all relationships)
	 * Unlike trash, purge allows detaching Directors and Cast
	 */
	async purgeWork(id: number) {
		const work = await prisma.work.findUnique({
			where: { id },
			select: { id: true, title: true },
		});

		if (!work) {
			throw new Error(`Work with id ${id} not found`);
		}

		// Permanently set purgedAt
		// Delete all director/homepage associations to detach
		await prisma.workDirector.deleteMany({ where: { workId: id } });
		await prisma.homepageDirector.deleteMany({ where: { workId: id } });

		return prisma.work.update({
			where: { id },
			data: {
				purgedAt: new Date(),
				status: "DRAFT",
			} as any,
		});
	}

	/**
	 * Bulk delete works (move to Trash)
	 * Directors and Cast relationships are preserved
	 */
	async bulkDeleteWorks(ids: number[]) {
		if (!ids.length)
			return {
				deletedIds: [],
				deletedWorks: [],
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Get works that are not already deleted/purged
		const works = await prisma.work.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: {
				id: true,
				title: true,
				deletedAt: true,
			},
		});

		const validIds: number[] = [];
		const validWorks: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; reason: string }> = [];

		for (const work of works) {
			if (work.deletedAt) {
				skipped.push({
					id: work.id,
					reason: "Already in trash",
				});
			} else {
				validIds.push(work.id);
				validWorks.push({ id: work.id, title: work.title });
			}
		}

		// Add not found items to skipped
		ids
			.filter((id) => !works.find((w) => w.id === id))
			.forEach((id) => {
				skipped.push({ id, reason: "Not found or already deleted" });
			});

		if (validIds.length) {
			await prisma.work.updateMany({
				where: { id: { in: validIds } },
				data: { deletedAt: new Date(), status: "DRAFT" as any },
			});
		}

		return { deletedIds: validIds, deletedWorks: validWorks, skipped };
	}

	/**
	 * Bulk purge works (permanently hide from UI and detach all relationships)
	 * Unlike bulk delete, purge allows detaching Directors and Cast
	 */
	async bulkPurgeWorks(ids: number[]) {
		if (!ids.length)
			return {
				purgedIds: [],
				purgedWorks: [],
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Get works that are not already purged
		const works = await prisma.work.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: {
				id: true,
				title: true,
			},
		});

		const validIds: number[] = [];
		const validWorks: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; reason: string }> = [];

		for (const work of works) {
			validIds.push(work.id);
			validWorks.push({ id: work.id, title: work.title });
		}

		// Add not found items to skipped
		ids
			.filter((id) => !works.find((w) => w.id === id))
			.forEach((id) => {
				skipped.push({ id, reason: "Not found or already deleted" });
			});

		if (validIds.length) {
			// Delete all relationships for the works being purged
			await prisma.workDirector.deleteMany({
				where: { workId: { in: validIds } },
			});
			await prisma.homepageDirector.deleteMany({
				where: { workId: { in: validIds } },
			});

			// Then mark as purged
			await prisma.work.updateMany({
				where: { id: { in: validIds } },
				data: { purgedAt: new Date(), status: "DRAFT" as any },
			});
		}

		return { purgedIds: validIds, purgedWorks: validWorks, skipped };
	}

	/**
	 * List trashed works
	 */
	async getTrashedWorks(query: Omit<GetWorksQuery, "status"> & { status?: GetWorksQuery["status"] }) {
		// Reuse getWorks but force trashed visibility
		return this.getWorks({ ...query, status: query.status ?? "ALL" }, { includeTrashed: true, includePurged: false });
	}

	/**
	 * Publish work
	 */
	async publishWork(id: number) {
		const work = await prisma.work.update({
			where: { id },
			data: {
				status: "PUBLISHED",
				publishedAt: new Date(),
			},
			include: {
				videoFile: true,
				previewImage: true,
				directors: {
					include: {
						director: {
							include: {
								avatar: true,
							},
						},
					},
				},
			} as any,
		});

		// Trigger clip processing for blocks with crop/trim settings
		try {
			await this.triggerClipProcessingForWork(id);
		} catch (error) {
			console.error(`[WorksService] Failed to trigger clip processing for work ${id}:`, error);
			// Don't fail the publish - clip processing is optional
		}

		// Trigger website revalidation for list and detail
		try {
			await revalidatePaths(["/works", `/works/${work.slug}`]);
		} catch {}

		return serializeWork(work);
	}

	/**
	 * Trigger clip processing for all video blocks in a work
	 */
	private async triggerClipProcessingForWork(workId: number) {
		// Get all blocks for this work
		const blocks = await prisma.block.findMany({
			where: {
				modelName: "work",
				modelId: workId,
			},
		});

		const clipJobPromises: Promise<any>[] = [];

		for (const block of blocks) {
			const content = block.content as { items?: any[] } | null;
			if (!content?.items || !Array.isArray(content.items)) continue;

			// Process each item in the block
			for (let slotIndex = 0; slotIndex < content.items.length; slotIndex++) {
				const item = content.items[slotIndex];

				// Skip if no workId (video reference)
				if (!item.workId) continue;

				// Get the work to find its videoFileId
				const itemWork = await prisma.work.findUnique({
					where: { id: item.workId },
					select: { id: true, videoFileId: true },
				});

				if (!itemWork?.videoFileId) continue;

				// Check if crop or trim settings exist
				const hasCrop =
					item.cropX !== undefined || item.cropY !== undefined || item.cropW !== undefined || item.cropH !== undefined;
				const hasTrim = item.trimStart !== undefined || item.trimEnd !== undefined;

				if (!hasCrop && !hasTrim) continue;

				// Build crop settings if any crop property is set
				const cropSettings = hasCrop
					? (() => {
							const aspect = item.cropAspect ?? 16 / 9;
							const presets = [
								{ label: "Ultra Widescreen (21:9)", value: 21 / 9 },
								{ label: "Standard Widescreen (16:9)", value: 16 / 9 },
								{ label: "Poster (5:4)", value: 5 / 4 },
								{ label: "Classic (4:3)", value: 4 / 3 },
								{ label: "Photo (3:2)", value: 3 / 2 },
								{ label: "Modern Cinematic (2:1)", value: 2 / 1 },
								{ label: "Square (1:1)", value: 1 },
								{ label: "Portrait Photo (2:3)", value: 2 / 3 },
								{ label: "Classic Portrait (3:4)", value: 3 / 4 },
								{ label: "Social Portrait (4:5)", value: 4 / 5 },
								{ label: "Story / Reel (9:16)", value: 9 / 16 },
								{ label: "Vertical Poster (1:2)", value: 1 / 2 },
							];
							const matched = presets.find((p) => Math.abs(aspect - p.value) < 0.01);
							return {
								x: item.cropX ?? 0,
								y: item.cropY ?? 0,
								width: item.cropW ?? 100,
								height: item.cropH ?? 100,
								aspect,
								aspectLabel: matched ? matched.label : "Freeform",
							};
						})()
					: undefined;

				// Build trim settings if any trim property is set
				const trimSettings = hasTrim
					? {
							startTime: item.trimStart ?? 0,
							endTime: item.trimEnd ?? 0,
						}
					: undefined;

				// Queue clip job
				clipJobPromises.push(
					clipProcessingService.createClipJob({
						contextType: "block",
						contextId: block.id,
						slotIndex,
						blockType: block.type as BlockType,
						mediaFileId: itemWork.videoFileId,
						workId: itemWork.id, // For verification during webhook updates
						cropSettings,
						trimSettings,
					}),
				);
			}
		}

		// Execute all clip jobs in parallel
		if (clipJobPromises.length > 0) {
			const results = await Promise.allSettled(clipJobPromises);
			const succeeded = results.filter((r) => r.status === "fulfilled" && r.value).length;
			const failed = results.filter((r) => r.status === "rejected").length;
			console.log(`[WorksService] Triggered ${succeeded} clip jobs for work ${workId} (${failed} failed)`);
		}
	}

	/**
	 * Unpublish work
	 */
	async unpublishWork(id: number) {
		const work = await prisma.work.update({
			where: { id },
			data: {
				status: "DRAFT",
				publishedAt: null,
			},
			include: {
				videoFile: true,
				previewImage: true,
				directors: {
					include: {
						director: {
							include: {
								avatar: true,
							},
						},
					},
				},
			} as any,
		});

		// Trigger website revalidation to update list and detail page
		try {
			await revalidatePaths(["/works", `/works/${work.slug}`]);
		} catch {}

		return serializeWork(work);
	}

	/**
	 * Reorder works
	 */
	async reorderWorks(workIds: number[]) {
		const updates = workIds.map((workId, index) =>
			prisma.work.update({
				where: { id: workId },
				data: { sortOrder: index + 1 },
			}),
		);

		await Promise.all(updates);

		return {
			message: "Works reordered successfully",
			count: workIds.length,
		};
	}

	/**
	 * Revert work to a specific revision
	 */
	async revertToRevision(workId: number, revisionId: number, userId: number) {
		// Get the revision
		const revision = await prisma.workRevision.findFirst({
			where: {
				id: revisionId,
				workId: workId,
			},
		});

		if (!revision) {
			return null;
		}

		// Extract the payload data
		const payload = revision.payload as any;

		// Build update data - only include fields that exist in the payload
		const updateData: any = {
			title: payload.title,
			shortDescription: payload.shortDescription,
			subtitle: payload.subtitle,
			caseStudy: payload.caseStudy,
			client: payload.client,
			tags: payload.tags || [],
			status: payload.status,
		};

		// Only update optional fields if they exist in the payload
		if ("videoFileId" in payload) {
			updateData.videoFileId = payload.videoFileId;
		}
		if ("metaDescription" in payload) {
			updateData.metaDescription = payload.metaDescription;
		}
		if ("metaKeywords" in payload) {
			updateData.metaKeywords = payload.metaKeywords;
		}
		if ("previewImageId" in payload) {
			updateData.previewImageId = payload.previewImageId;
		}
		if ("publishedAt" in payload) {
			updateData.publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : null;
		}

		// Update the work with the revision data
		const updatedWork = await prisma.work.update({
			where: { id: workId },
			data: updateData,
		});

		// Update directors
		if (payload.directorIds) {
			await prisma.workDirector.deleteMany({
				where: { workId: workId },
			});
			await prisma.workDirector.createMany({
				data: payload.directorIds.map((directorId: number) => ({
					workId: workId,
					directorId: directorId,
				})),
			});
		}

		// Create a new revision for this revert action
		const currentWork = await this.getWorkById(workId);
		if (currentWork && currentWork.revisions) {
			const latestVersion = Math.max(...currentWork.revisions.map((r: any) => r.version));

			// Build snapshot payload for the new revision
			const rawSnapshot = {
				title: currentWork.title,
				shortDescription: currentWork.shortDescription,
				subtitle: currentWork.subtitle,
				caseStudy: currentWork.caseStudy,
				client: currentWork.client,
				tags: currentWork.tags || [],
				videoFileId: currentWork.videoFileId,
				videoFileName: (currentWork as any).videoFile?.originalName,
				metaDescription: currentWork.metaDescription,
				metaKeywords: currentWork.metaKeywords,
				previewImageId: (currentWork as any).previewImageId,
				previewImageName: (currentWork as any).previewImage?.originalName,
				status: currentWork.status,
				sortOrder: currentWork.sortOrder,
				publishedAt: currentWork.publishedAt,
				directorIds: ((currentWork as any).directors || []).map((wd: any) => wd.directorId),
				directorNames: ((currentWork as any).directors || []).map((wd: any) => wd.director.title),
			};

			// Clean the snapshot to remove null/undefined/empty values
			const snapshot = cleanSnapshot(rawSnapshot);

			await prisma.workRevision.create({
				data: {
					workId: workId,
					userId: userId,
					version: latestVersion + 1,
					payload: snapshot as any,
					revertedFromId: revisionId, // Track which revision this was reverted from
				},
			});
		}

		return this.getWorkById(workId);
	}

	/**
	 * Get works statistics
	 */
	async getWorksStats() {
		const [total, published, draft] = await Promise.all([
			prisma.work.count(),
			prisma.work.count({ where: { status: "PUBLISHED" } }),
			prisma.work.count({ where: { status: "DRAFT" } }),
		]);

		return {
			total,
			published,
			draft,
		};
	}

	async bulkPublishWorks(ids: number[]): Promise<{
		publishedIds: number[];
		publishedWorks: Array<{ id: number; title: string }>;
		skipped: Array<{ id: number; title: string; reason: string }>;
	}> {
		if (!ids.length) {
			return { publishedIds: [], publishedWorks: [], skipped: [] };
		}

		// Fetch all works in a single query
		const works = await prisma.work.findMany({
			where: { id: { in: ids } },
			select: {
				id: true,
				title: true,
				status: true,
				deletedAt: true,
				purgedAt: true,
			},
		});

		// Convert to Map for O(1) lookup
		const worksMap = new Map(works.map((w) => [w.id, w]));

		const toPublish: number[] = [];
		const publishedWorks: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; title: string; reason: string }> = [];

		// Categorize works
		for (const id of ids) {
			const work = worksMap.get(id);

			if (!work) {
				skipped.push({ id, title: `Work ${id}`, reason: "Work not found" });
				continue;
			}

			if (work.deletedAt || work.purgedAt) {
				skipped.push({
					id,
					title: work.title,
					reason: "Work is deleted or permanently deleted",
				});
				continue;
			}

			if (work.status === "PUBLISHED") {
				skipped.push({
					id,
					title: work.title,
					reason: "Work is already published",
				});
				continue;
			}

			toPublish.push(id);
			publishedWorks.push({ id, title: work.title });
		}

		// Bulk update in a single query
		if (toPublish.length > 0) {
			await prisma.work.updateMany({
				where: { id: { in: toPublish } },
				data: {
					status: "PUBLISHED",
					publishedAt: new Date(),
				},
			});
		}

		return {
			publishedIds: toPublish,
			publishedWorks,
			skipped,
		};
	}

	async bulkUnpublishWorks(ids: number[]): Promise<{
		unpublishedIds: number[];
		unpublishedWorks: Array<{ id: number; title: string }>;
		skipped: Array<{ id: number; title: string; reason: string }>;
	}> {
		if (!ids.length) {
			return { unpublishedIds: [], unpublishedWorks: [], skipped: [] };
		}

		// Fetch all works in a single query
		const works = await prisma.work.findMany({
			where: { id: { in: ids } },
			select: {
				id: true,
				title: true,
				status: true,
				deletedAt: true,
				purgedAt: true,
			},
		});

		// Convert to Map for O(1) lookup
		const worksMap = new Map(works.map((w) => [w.id, w]));

		const toUnpublish: number[] = [];
		const unpublishedWorks: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; title: string; reason: string }> = [];

		// Categorize works
		for (const id of ids) {
			const work = worksMap.get(id);

			if (!work) {
				skipped.push({ id, title: `Work ${id}`, reason: "Work not found" });
				continue;
			}

			if (work.deletedAt || work.purgedAt) {
				skipped.push({
					id,
					title: work.title,
					reason: "Work is deleted or permanently deleted",
				});
				continue;
			}

			if (work.status === "DRAFT") {
				skipped.push({
					id,
					title: work.title,
					reason: "Work is already draft",
				});
				continue;
			}

			toUnpublish.push(id);
			unpublishedWorks.push({ id, title: work.title });
		}

		// Bulk update in a single query
		if (toUnpublish.length > 0) {
			await prisma.work.updateMany({
				where: { id: { in: toUnpublish } },
				data: {
					status: "DRAFT",
					publishedAt: null,
				},
			});
		}

		return {
			unpublishedIds: toUnpublish,
			unpublishedWorks,
			skipped,
		};
	}
}

export const worksService = new WorksService();
