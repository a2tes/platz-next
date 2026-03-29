import { prisma } from "../config/database";
import { Status } from "@prisma/client";
import { serializeAnimation } from "../utils/serialization";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { revalidatePaths } from "./revalidateService";

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

export interface CreateAnimationData {
	title: string;
	shortDescription?: string;
	client?: string;
	agency?: string;
	tags: string[];
	videoFileId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number | null;
	status: Status;
}

export interface UpdateAnimationData {
	title?: string;
	slug?: string;
	shortDescription?: string;
	client?: string;
	agency?: string;
	tags?: string[];
	videoFileId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	previewImageId?: number | null;
	status?: Status;
	publishedAt?: Date | null;
}

export interface GetAnimationsQuery {
	page: number;
	limit: number;
	search?: string;
	status: "DRAFT" | "PUBLISHED" | "ALL";
	sortBy: "title" | "client" | "createdAt" | "updatedAt" | "sortOrder";
	sortOrder: "asc" | "desc";
	mine?: boolean;
}

export interface GetAnimationsOptions {
	includeTrashed?: boolean;
	includePurged?: boolean;
	currentUserId?: number;
}

export class AnimationsService {
	/**
	 * Create a new animation
	 */
	async createAnimation(data: CreateAnimationData, userId?: number) {
		const animationData = { ...data };

		// Generate unique slug
		const baseSlug = slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.animation.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		// Get the next sort order
		const lastAnimation = await prisma.animation.findFirst({
			orderBy: { sortOrder: "desc" },
		});
		const sortOrder = (lastAnimation?.sortOrder || 0) + 1;

		const animation = await prisma.animation.create({
			data: {
				...animationData,
				shortDescription: animationData.shortDescription ?? null,
				slug,
				sortOrder,
				publishedAt: animationData.status === "PUBLISHED" ? new Date() : null,
				createdBy: userId,
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
			} as any,
		});

		// Create initial revision (V0 - baseline) if userId is provided
		if (userId) {
			const rawSnapshot = {
				title: animation.title,
				shortDescription: animation.shortDescription,
				client: animation.client,
				agency: animation.agency,
				tags: animation.tags || [],
				videoFileId: animation.videoFileId,
				videoFileName: (animation as any).videoFile?.originalName,
				metaDescription: animation.metaDescription,
				metaKeywords: animation.metaKeywords,
				previewImageId: (animation as any).previewImageId,
				previewImageName: (animation as any).previewImage?.originalName,
				status: animation.status,
				sortOrder: animation.sortOrder,
				publishedAt: animation.publishedAt,
			};

			const snapshot = cleanSnapshot(rawSnapshot);

			await prisma.animationRevision.create({
				data: {
					animationId: animation.id,
					userId,
					version: 0,
					payload: snapshot as any,
				},
			});

			// Fetch animation again with revisions included
			const animationWithRevisions = await prisma.animation.findUnique({
				where: { id: animation.id },
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
				} as any,
			});

			return serializeAnimation(animationWithRevisions);
		}

		return serializeAnimation(animation);
	}

	/**
	 * Get animations with pagination and filtering
	 */
	async getAnimations(query: GetAnimationsQuery, options: GetAnimationsOptions = {}) {
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

		// Mine scope: only animations created by current user
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

		const [animations, total] = await Promise.all([
			prisma.animation.findMany({
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
				} as any,
				orderBy,
				skip,
				take: limit,
			}),
			prisma.animation.count({ where }),
		]);

		return {
			animations: animations.map(serializeAnimation),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Get counts for Animations filters: all, mine, published, draft, trash
	 */
	async getFilterCounts(userId: number) {
		const baseWhere = { purgedAt: null } as any;
		const nonTrashed = { ...baseWhere, deletedAt: null } as any;
		const trashed = { ...baseWhere, deletedAt: { not: null } } as any;

		const [all, mine, published, draft, trash] = await Promise.all([
			prisma.animation.count({ where: nonTrashed }),
			prisma.animation.count({ where: { ...nonTrashed, createdBy: userId } }),
			prisma.animation.count({
				where: { ...nonTrashed, status: "PUBLISHED" as any },
			}),
			prisma.animation.count({ where: { ...nonTrashed, status: "DRAFT" as any } }),
			prisma.animation.count({ where: trashed }),
		]);

		return { all, mine, published, draft, trash };
	}

	/**
	 * Get animation by ID
	 */
	async getAnimationById(id: number, options: GetAnimationsOptions = {}) {
		const animation = await prisma.animation.findFirst({
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
			} as any,
		});

		return serializeAnimation(animation);
	}

	/**
	 * Update only animation title (minor update, creates revision)
	 */
	async updateAnimationTitle(id: number, title: string, userId?: number) {
		// Get current animation
		const currentAnimation = await prisma.animation.findUnique({
			where: { id },
			select: {
				title: true,
				shortDescription: true,
				client: true,
				status: true,
				sortOrder: true,
				publishedAt: true,
			},
		});

		if (!currentAnimation) {
			throw new Error("Animation not found");
		}

		// Generate new slug
		const baseSlug = slugify(title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.animation.findUnique({
				where: { slug: s },
			});
			return existing ? existing.id !== id : false;
		});

		// Get the latest version number
		const latestRevision = await prisma.animationRevision.findFirst({
			where: { animationId: id },
			orderBy: { version: "desc" },
			select: { version: true },
		});

		const nextVersion = latestRevision ? latestRevision.version + 1 : 1;

		// Create revision with current data (snapshot before change)
		await prisma.animationRevision.create({
			data: {
				animationId: id,
				userId: userId || 1,
				version: nextVersion,
				payload: currentAnimation as any,
			},
		});

		// Update animation title and slug
		const animation = await prisma.animation.update({
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
			} as any,
		});

		return serializeAnimation(animation);
	}

	/**
	 * Update animation
	 */
	async updateAnimation(id: number, data: UpdateAnimationData, userId?: number) {
		const animationData = { ...data };

		// Get current animation first to fetch existing revisions
		const currentAnimation = await prisma.animation.findUnique({
			where: { id },
			include: {
				revisions: {
					orderBy: { createdAt: "desc" },
					take: 1,
				},
			},
		});

		if (!currentAnimation) {
			throw new Error("Animation not found");
		}

		// If title is being updated, regenerate slug
		if (data.title && data.title !== currentAnimation.title) {
			const baseSlug = slugify(data.title);
			animationData.slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.animation.findUnique({
					where: { slug: s },
				});
				return existing ? existing.id !== id : false;
			});
		}

		// If status is being changed to PUBLISHED, set publishedAt
		if (animationData.status === "PUBLISHED") {
			if (currentAnimation.status === "DRAFT") {
				animationData.publishedAt = new Date();
			}
		}

		const animation = await prisma.animation.update({
			where: { id },
			data: animationData,
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
			} as any,
		});

		// Create a revision record if userId is provided and there are actual changes
		if (userId) {
			let hasChanges = false;

			// Compare scalar fields provided in animationData
			for (const [key, value] of Object.entries(animationData)) {
				const currentValue = (currentAnimation as any)[key];
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

			// Only create revision if there are actual changes
			if (hasChanges) {
				const nextVersion = (currentAnimation.revisions?.[0]?.version || 0) + 1;

				// Build snapshot payload from the updated animation state
				const rawSnapshot = {
					title: animation.title,
					shortDescription: animation.shortDescription,
					client: animation.client,
					agency: animation.agency,
					tags: animation.tags || [],
					videoFileId: animation.videoFileId,
					videoFileName: (animation as any).videoFile?.originalName,
					metaDescription: animation.metaDescription,
					metaKeywords: animation.metaKeywords,
					previewImageId: (animation as any).previewImageId,
					previewImageName: (animation as any).previewImage?.originalName,
					status: animation.status,
					sortOrder: animation.sortOrder,
					publishedAt: animation.publishedAt,
				};

				const snapshot = cleanSnapshot(rawSnapshot);

				await prisma.animationRevision.create({
					data: {
						animationId: id,
						userId,
						version: nextVersion,
						payload: snapshot as any,
					},
				});
			}
		}

		// Revalidate if status toggled publish/draft or slug changed
		try {
			const changedToPublished = animationData.status === "PUBLISHED" && currentAnimation.status !== "PUBLISHED";
			const changedFromPublished = animationData.status === "DRAFT" && currentAnimation.status === "PUBLISHED";
			const slugChanged = !!animationData.slug && animationData.slug !== currentAnimation.slug;
			if (changedToPublished || changedFromPublished || slugChanged) {
				const paths = new Set<string>(["/animations", `/animations/${animation.slug}`]);
				if (slugChanged) paths.add(`/animations/${currentAnimation.slug}`);
				await revalidatePaths(Array.from(paths));
			}
		} catch {}

		return serializeAnimation(animation);
	}

	/**
	 * Delete animation (move to trash)
	 */
	async deleteAnimation(id: number) {
		const animation = await prisma.animation.findUnique({
			where: { id },
			select: { id: true, title: true, status: true },
		});

		if (!animation) {
			throw new Error(`Animation with id ${id} not found`);
		}

		return prisma.animation.update({
			where: { id },
			data: {
				deletedAt: new Date(),
				status: "DRAFT",
			} as any,
		});
	}

	/**
	 * Move animation to trash
	 */
	async trashAnimation(id: number) {
		const animation = await prisma.animation.findUnique({
			where: { id },
			select: { id: true, title: true },
		});

		if (!animation) {
			throw new Error(`Animation with id ${id} not found`);
		}

		return prisma.animation.update({
			where: { id },
			data: { deletedAt: new Date() } as any,
		});
	}

	/**
	 * Restore animation from trash
	 */
	async restoreAnimation(id: number) {
		return prisma.animation.update({
			where: { id },
			data: { deletedAt: null } as any,
		});
	}

	/**
	 * Purge animation (permanently hide from UI)
	 */
	async purgeAnimation(id: number) {
		const animation = await prisma.animation.findUnique({
			where: { id },
			select: { id: true, title: true },
		});

		if (!animation) {
			throw new Error(`Animation with id ${id} not found`);
		}

		return prisma.animation.update({
			where: { id },
			data: {
				purgedAt: new Date(),
				status: "DRAFT",
			} as any,
		});
	}

	/**
	 * Bulk delete animations (move to Trash)
	 */
	async bulkDeleteAnimations(ids: number[]) {
		if (!ids.length)
			return {
				deletedIds: [],
				deletedAnimations: [],
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Get animations that are not already deleted/purged
		const animations = await prisma.animation.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: {
				id: true,
				title: true,
				deletedAt: true,
			},
		});

		const validIds: number[] = [];
		const validAnimations: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; reason: string }> = [];

		for (const animation of animations) {
			if (animation.deletedAt) {
				skipped.push({
					id: animation.id,
					reason: "Already in trash",
				});
			} else {
				validIds.push(animation.id);
				validAnimations.push({ id: animation.id, title: animation.title });
			}
		}

		// Add not found items to skipped
		ids
			.filter((id) => !animations.find((a) => a.id === id))
			.forEach((id) => {
				skipped.push({ id, reason: "Not found or already deleted" });
			});

		if (validIds.length) {
			await prisma.animation.updateMany({
				where: { id: { in: validIds } },
				data: { deletedAt: new Date(), status: "DRAFT" as any },
			});
		}

		return { deletedIds: validIds, deletedAnimations: validAnimations, skipped };
	}

	/**
	 * Bulk purge animations (permanently hide from UI)
	 */
	async bulkPurgeAnimations(ids: number[]) {
		if (!ids.length)
			return {
				purgedIds: [],
				purgedAnimations: [],
				skipped: [] as Array<{ id: number; reason: string }>,
			};

		// Get animations that are not already purged
		const animations = await prisma.animation.findMany({
			where: { id: { in: ids }, purgedAt: null },
			select: {
				id: true,
				title: true,
			},
		});

		const validIds: number[] = [];
		const validAnimations: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; reason: string }> = [];

		for (const animation of animations) {
			validIds.push(animation.id);
			validAnimations.push({ id: animation.id, title: animation.title });
		}

		// Add not found items to skipped
		ids
			.filter((id) => !animations.find((a) => a.id === id))
			.forEach((id) => {
				skipped.push({ id, reason: "Not found or already deleted" });
			});

		if (validIds.length) {
			await prisma.animation.updateMany({
				where: { id: { in: validIds } },
				data: { purgedAt: new Date(), status: "DRAFT" as any },
			});
		}

		return { purgedIds: validIds, purgedAnimations: validAnimations, skipped };
	}

	/**
	 * List trashed animations
	 */
	async getTrashedAnimations(query: Omit<GetAnimationsQuery, "status"> & { status?: GetAnimationsQuery["status"] }) {
		return this.getAnimations(
			{ ...query, status: query.status ?? "ALL" },
			{ includeTrashed: true, includePurged: false }
		);
	}

	/**
	 * Publish animation
	 */
	async publishAnimation(id: number) {
		const animation = await prisma.animation.update({
			where: { id },
			data: {
				status: "PUBLISHED",
				publishedAt: new Date(),
			},
			include: {
				videoFile: true,
				previewImage: true,
			} as any,
		});

		// Trigger website revalidation for list and detail
		try {
			await revalidatePaths(["/animations", `/animations/${animation.slug}`]);
		} catch {}

		return serializeAnimation(animation);
	}

	/**
	 * Unpublish animation
	 */
	async unpublishAnimation(id: number) {
		const animation = await prisma.animation.update({
			where: { id },
			data: {
				status: "DRAFT",
				publishedAt: null,
			},
			include: {
				videoFile: true,
				previewImage: true,
			} as any,
		});

		// Trigger website revalidation to update list and detail page
		try {
			await revalidatePaths(["/animations", `/animations/${animation.slug}`]);
		} catch {}

		return serializeAnimation(animation);
	}

	/**
	 * Reorder animations
	 */
	async reorderAnimations(animationIds: number[]) {
		const updates = animationIds.map((animationId, index) =>
			prisma.animation.update({
				where: { id: animationId },
				data: { sortOrder: index + 1 },
			})
		);

		await Promise.all(updates);

		return {
			message: "Animations reordered successfully",
			count: animationIds.length,
		};
	}

	/**
	 * Revert animation to a specific revision
	 */
	async revertToRevision(animationId: number, revisionId: number, userId: number) {
		// Get the revision
		const revision = await prisma.animationRevision.findFirst({
			where: {
				id: revisionId,
				animationId: animationId,
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
			client: payload.client,
			agency: payload.agency,
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

		// Update the animation with the revision data
		await prisma.animation.update({
			where: { id: animationId },
			data: updateData,
		});

		// Create a new revision for this revert action
		const currentAnimation = await this.getAnimationById(animationId);
		if (currentAnimation && currentAnimation.revisions) {
			const latestVersion = Math.max(...currentAnimation.revisions.map((r: any) => r.version));

			// Build snapshot payload for the new revision
			const rawSnapshot = {
				title: currentAnimation.title,
				shortDescription: currentAnimation.shortDescription,
				client: currentAnimation.client,
				agency: currentAnimation.agency,
				tags: currentAnimation.tags || [],
				videoFileId: currentAnimation.videoFileId,
				videoFileName: (currentAnimation as any).videoFile?.originalName,
				metaDescription: currentAnimation.metaDescription,
				metaKeywords: currentAnimation.metaKeywords,
				previewImageId: (currentAnimation as any).previewImageId,
				previewImageName: (currentAnimation as any).previewImage?.originalName,
				status: currentAnimation.status,
				sortOrder: currentAnimation.sortOrder,
				publishedAt: currentAnimation.publishedAt,
			};

			const snapshot = cleanSnapshot(rawSnapshot);

			await prisma.animationRevision.create({
				data: {
					animationId: animationId,
					userId: userId,
					version: latestVersion + 1,
					payload: snapshot as any,
					revertedFromId: revisionId,
				},
			});
		}

		return this.getAnimationById(animationId);
	}

	/**
	 * Get animations statistics
	 */
	async getAnimationsStats() {
		const [total, published, draft] = await Promise.all([
			prisma.animation.count(),
			prisma.animation.count({ where: { status: "PUBLISHED" } }),
			prisma.animation.count({ where: { status: "DRAFT" } }),
		]);

		return {
			total,
			published,
			draft,
		};
	}

	async bulkPublishAnimations(ids: number[]): Promise<{
		publishedIds: number[];
		publishedAnimations: Array<{ id: number; title: string }>;
		skipped: Array<{ id: number; title: string; reason: string }>;
	}> {
		if (!ids.length) {
			return { publishedIds: [], publishedAnimations: [], skipped: [] };
		}

		// Fetch all animations in a single query
		const animations = await prisma.animation.findMany({
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
		const animationsMap = new Map(animations.map((a) => [a.id, a]));

		const toPublish: number[] = [];
		const publishedAnimations: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; title: string; reason: string }> = [];

		// Categorize animations
		for (const id of ids) {
			const animation = animationsMap.get(id);

			if (!animation) {
				skipped.push({ id, title: `Animation ${id}`, reason: "Animation not found" });
				continue;
			}

			if (animation.deletedAt || animation.purgedAt) {
				skipped.push({
					id,
					title: animation.title,
					reason: "Animation is deleted or permanently deleted",
				});
				continue;
			}

			if (animation.status === "PUBLISHED") {
				skipped.push({
					id,
					title: animation.title,
					reason: "Animation is already published",
				});
				continue;
			}

			toPublish.push(id);
			publishedAnimations.push({ id, title: animation.title });
		}

		// Bulk update in a single query
		if (toPublish.length > 0) {
			await prisma.animation.updateMany({
				where: { id: { in: toPublish } },
				data: {
					status: "PUBLISHED",
					publishedAt: new Date(),
				},
			});
		}

		return {
			publishedIds: toPublish,
			publishedAnimations,
			skipped,
		};
	}

	async bulkUnpublishAnimations(ids: number[]): Promise<{
		unpublishedIds: number[];
		unpublishedAnimations: Array<{ id: number; title: string }>;
		skipped: Array<{ id: number; title: string; reason: string }>;
	}> {
		if (!ids.length) {
			return { unpublishedIds: [], unpublishedAnimations: [], skipped: [] };
		}

		// Fetch all animations in a single query
		const animations = await prisma.animation.findMany({
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
		const animationsMap = new Map(animations.map((a) => [a.id, a]));

		const toUnpublish: number[] = [];
		const unpublishedAnimations: Array<{ id: number; title: string }> = [];
		const skipped: Array<{ id: number; title: string; reason: string }> = [];

		// Categorize animations
		for (const id of ids) {
			const animation = animationsMap.get(id);

			if (!animation) {
				skipped.push({ id, title: `Animation ${id}`, reason: "Animation not found" });
				continue;
			}

			if (animation.deletedAt || animation.purgedAt) {
				skipped.push({
					id,
					title: animation.title,
					reason: "Animation is deleted or permanently deleted",
				});
				continue;
			}

			if (animation.status === "DRAFT") {
				skipped.push({
					id,
					title: animation.title,
					reason: "Animation is already draft",
				});
				continue;
			}

			toUnpublish.push(id);
			unpublishedAnimations.push({ id, title: animation.title });
		}

		// Bulk update in a single query
		if (toUnpublish.length > 0) {
			await prisma.animation.updateMany({
				where: { id: { in: toUnpublish } },
				data: {
					status: "DRAFT",
					publishedAt: null,
				},
			});
		}

		return {
			unpublishedIds: toUnpublish,
			unpublishedAnimations,
			skipped,
		};
	}
}

export const animationsService = new AnimationsService();
