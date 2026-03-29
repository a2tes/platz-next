import { prisma } from "../config/database";
import { PageType, Status } from "@prisma/client";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { revalidatePaths } from "./revalidateService";

export interface UpdateContentPageData {
	title?: string;
	contentBlocks?: unknown | null;
	mapEmbed?: string | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	previewImageId?: number | null;
	status?: Status;
	// Only used on create to set the creator user id
	createdBy?: number;
}

class ContentPagesService {
	async getByType(type: PageType) {
		const page = await prisma.contentPage.findFirst({
			where: { type, deletedAt: null } as any,
			include: {
				previewImage: true,
			},
		});
		return page;
	}

	async listByType(type: PageType) {
		return prisma.contentPage.findMany({
			where: { type, deletedAt: null } as any,
			orderBy: { updatedAt: "desc" },
			include: { previewImage: true },
		});
	}

	async getById(id: number) {
		return prisma.contentPage.findUnique({
			where: { id },
			include: {
				previewImage: true,
				creator: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});
	}

	async create(type: PageType, data: UpdateContentPageData) {
		const now = new Date();
		// Generate unique slug from title
		const baseSlug = slugify(data.title || "untitled");

		let retries = 3;
		while (retries > 0) {
			const slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.contentPage.findFirst({
					where: { slug: s } as any,
				});
				return !!existing;
			});

			try {
				const created = await prisma.contentPage.create({
					data: {
						type,
						slug,
						title: data.title || "Untitled",
						contentBlocks: (data.contentBlocks as any) ?? null,
						metaDescription: data.metaDescription || null,
						metaKeywords: data.metaKeywords || null,
						previewImageId: data.previewImageId ?? null,
						status: data.status || Status.DRAFT,
						publishedAt: data.status === Status.PUBLISHED ? now : null,
						...(data.createdBy !== undefined
							? { createdBy: data.createdBy }
							: {}),
					} as any,
					include: { previewImage: true },
				});

				// If published on create, revalidate relevant page path
				try {
					if (created.status === Status.PUBLISHED) {
						const path =
							created.type === PageType.LEGAL
								? `/legal/${created.slug}`
								: `/${created.slug}`;
						await revalidatePaths([path]);
					}
				} catch {}

				return created;
			} catch (error: any) {
				if (error.code === "P2002") {
					const target = error.meta?.target;
					const isSlug = Array.isArray(target)
						? target.includes("slug")
						: target === "slug";
					if (isSlug) {
						retries--;
						continue;
					}
				}
				throw error;
			}
		}
		throw new Error("Failed to create page: Could not generate unique slug");
	}

	async updateById(id: number, data: UpdateContentPageData) {
		const page = await prisma.contentPage.findUnique({ where: { id } });
		if (!page) return null;
		const nextStatus = data.status ?? page.status;
		const publishedAt =
			nextStatus === Status.PUBLISHED ? page.publishedAt ?? new Date() : null;
		// If title is being updated, regenerate slug
		let slugUpdate: { slug?: string } = {};
		if (data.title && data.title !== page.title) {
			const baseSlug = slugify(data.title);
			const newSlug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.contentPage.findFirst({
					where: { slug: s } as any,
				});
				return existing ? existing.id !== id : false;
			});
			slugUpdate.slug = newSlug;
		}

		const updated = await prisma.contentPage.update({
			where: { id },
			data: {
				...slugUpdate,
				title: data.title ?? page.title,
				contentBlocks:
					data.contentBlocks !== undefined
						? (data.contentBlocks as any)
						: page.contentBlocks,
				metaDescription:
					data.metaDescription !== undefined
						? data.metaDescription
						: page.metaDescription,
				metaKeywords:
					data.metaKeywords !== undefined
						? data.metaKeywords
						: page.metaKeywords,
				previewImageId:
					data.previewImageId !== undefined
						? data.previewImageId
						: page.previewImageId,
				status: nextStatus,
				publishedAt,
			},
			include: { previewImage: true },
		});

		// Revalidate if publishing state changed or slug changed
		try {
			const becamePublished =
				nextStatus === Status.PUBLISHED && page.status !== Status.PUBLISHED;
			const becameDraft =
				nextStatus === Status.DRAFT && page.status === Status.PUBLISHED;
			const slugChanged = !!slugUpdate.slug && slugUpdate.slug !== page.slug;
			if (becamePublished || becameDraft || slugChanged) {
				const newPath =
					updated.type === PageType.LEGAL
						? `/legal/${updated.slug}`
						: `/${updated.slug}`;
				const paths = new Set<string>([newPath]);
				if (slugChanged) {
					const oldPath =
						page.type === PageType.LEGAL
							? `/legal/${page.slug}`
							: `/${page.slug}`;
					paths.add(oldPath);
				}
				await revalidatePaths(Array.from(paths));
			}
		} catch {}

		return updated;
	}

	async updateByType(type: PageType, data: UpdateContentPageData) {
		const now = new Date();
		const page = await prisma.contentPage.findFirst({ where: { type } });

		if (!page) {
			// If page doesn't exist (should exist from seed), create it
			const baseSlug = slugify(data.title || "about");
			const slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.contentPage.findFirst({
					where: { slug: s } as any,
				});
				return !!existing;
			});
			return prisma.contentPage.create({
				data: {
					type,
					slug,
					title: data.title || "About",
					contentBlocks: (data.contentBlocks as any) ?? null,
					mapEmbed: data.mapEmbed || null,
					metaDescription: data.metaDescription || null,
					metaKeywords: data.metaKeywords || null,
					previewImageId: data.previewImageId ?? null,
					status: data.status || Status.DRAFT,
					publishedAt: data.status === Status.PUBLISHED ? now : null,
				} as any,
				include: { previewImage: true },
			});
		}

		const nextStatus = data.status ?? page.status;
		const publishedAt =
			nextStatus === Status.PUBLISHED ? page.publishedAt ?? now : null;

		// If title changed, regenerate slug
		let slugUpdate: { slug?: string } = {};
		if (data.title && data.title !== page.title) {
			const baseSlug2 = slugify(data.title);
			const newSlug2 = await generateUniqueSlug(baseSlug2, async (s) => {
				const existing = await prisma.contentPage.findFirst({
					where: { slug: s } as any,
				});
				return existing ? existing.id !== page.id : false;
			});
			slugUpdate.slug = newSlug2;
		}

		const updated2 = await prisma.contentPage.update({
			where: { id: page.id },
			data: {
				...slugUpdate,
				title: data.title ?? page.title,
				contentBlocks:
					data.contentBlocks !== undefined
						? (data.contentBlocks as any)
						: page.contentBlocks,
				mapEmbed:
					data.mapEmbed !== undefined ? data.mapEmbed : (page as any).mapEmbed,
				metaDescription:
					data.metaDescription !== undefined
						? data.metaDescription
						: page.metaDescription,
				metaKeywords:
					data.metaKeywords !== undefined
						? data.metaKeywords
						: page.metaKeywords,
				previewImageId:
					data.previewImageId !== undefined
						? data.previewImageId
						: page.previewImageId,
				status: nextStatus,
				publishedAt,
			} as any,
			include: { previewImage: true },
		});

		try {
			const becamePublished2 =
				nextStatus === Status.PUBLISHED && page.status !== Status.PUBLISHED;
			const becameDraft2 =
				nextStatus === Status.DRAFT && page.status === Status.PUBLISHED;
			const slugChanged2 = !!slugUpdate.slug && slugUpdate.slug !== page.slug;
			if (becamePublished2 || becameDraft2 || slugChanged2) {
				const newPath2 =
					updated2.type === PageType.LEGAL
						? `/legal/${updated2.slug}`
						: `/${updated2.slug}`;
				const paths2 = new Set<string>([newPath2]);
				if (slugChanged2) {
					const oldPath2 =
						page.type === PageType.LEGAL
							? `/legal/${page.slug}`
							: `/${page.slug}`;
					paths2.add(oldPath2);
				}
				await revalidatePaths(Array.from(paths2));
			}
		} catch {}

		return updated2;
	}

	async listLegalPaginated(params: {
		search?: string;
		status?: Status;
		page: number;
		limit: number;
		mineUserId?: number;
	}) {
		const where: any = { type: PageType.LEGAL, deletedAt: null };
		if (params.status) where.status = params.status;
		if (params.mineUserId) where.createdBy = params.mineUserId;
		if (params.search) {
			where.OR = [
				{ title: { contains: params.search } },
				{ metaDescription: { contains: params.search } },
				{ metaKeywords: { contains: params.search } },
			];
		}

		const skip = (params.page - 1) * params.limit;
		const [total, items] = await Promise.all([
			prisma.contentPage.count({ where }),
			prisma.contentPage.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				skip,
				take: params.limit,
				include: {
					previewImage: true,
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
		]);

		return {
			data: items,
			meta: {
				pagination: {
					page: params.page,
					limit: params.limit,
					totalItems: total,
					totalPages: Math.ceil(total / params.limit),
				},
			},
		};
	}

	async deleteById(id: number) {
		try {
			await prisma.contentPage.update({
				where: { id },
				data: { deletedAt: new Date() } as any,
			});
			return true;
		} catch (e) {
			return false;
		}
	}

	async restoreById(id: number) {
		try {
			await prisma.contentPage.update({
				where: { id },
				data: { deletedAt: null } as any,
			});
			return true;
		} catch (e) {
			return false;
		}
	}

	async purgeById(id: number) {
		try {
			await prisma.contentPage.delete({ where: { id } });
			return true;
		} catch (e) {
			return false;
		}
	}

	async listLegalTrashedPaginated(params: {
		search?: string;
		page: number;
		limit: number;
	}) {
		const where: any = { type: PageType.LEGAL, NOT: { deletedAt: null } };
		if (params.search) {
			where.OR = [
				{ title: { contains: params.search } },
				{ metaDescription: { contains: params.search } },
				{ metaKeywords: { contains: params.search } },
			];
		}
		const skip = (params.page - 1) * params.limit;
		const [total, items] = await Promise.all([
			prisma.contentPage.count({ where: where as any }),
			prisma.contentPage.findMany({
				where: where as any,
				orderBy: { updatedAt: "desc" },
				skip,
				take: params.limit,
				include: {
					previewImage: true,
					creator: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
		]);
		return {
			data: items,
			meta: {
				pagination: {
					page: params.page,
					limit: params.limit,
					totalItems: total,
					totalPages: Math.ceil(total / params.limit),
				},
			},
		};
	}

	async countsLegal(userId: number) {
		const base = { type: PageType.LEGAL, deletedAt: null } as any;
		const [all, mine, published, draft, trash] = await Promise.all([
			prisma.contentPage.count({ where: base as any }),
			prisma.contentPage.count({
				where: { ...(base as any), createdBy: userId },
			}),
			prisma.contentPage.count({
				where: { ...(base as any), status: Status.PUBLISHED },
			}),
			prisma.contentPage.count({
				where: { ...(base as any), status: Status.DRAFT },
			}),
			prisma.contentPage.count({
				where: { type: PageType.LEGAL, NOT: { deletedAt: null } } as any,
			}),
		]);
		return { all, mine, published, draft, trash };
	}

	async bulkPublish(ids: number[]) {
		const now = new Date();
		// Fetch pages before update to return them
		const pages = await prisma.contentPage.findMany({
			where: { id: { in: ids } },
			select: { id: true, title: true, slug: true, type: true },
		});

		await prisma.contentPage.updateMany({
			where: { id: { in: ids } },
			data: { status: Status.PUBLISHED, publishedAt: now } as any,
		});

		// Revalidate paths for these pages
		const paths = pages.map((p) =>
			p.type === PageType.LEGAL ? `/legal/${p.slug}` : `/${p.slug}`
		);
		await revalidatePaths(paths);
		return pages;
	}

	async bulkUnpublish(ids: number[]) {
		// Fetch pages before update to return them
		const pages = await prisma.contentPage.findMany({
			where: { id: { in: ids } },
			select: { id: true, title: true, slug: true, type: true },
		});

		await prisma.contentPage.updateMany({
			where: { id: { in: ids } },
			data: { status: Status.DRAFT } as any,
		});

		// Revalidate paths for these pages
		const paths = pages.map((p) =>
			p.type === PageType.LEGAL ? `/legal/${p.slug}` : `/${p.slug}`
		);
		await revalidatePaths(paths);
		return pages;
	}

	async bulkDelete(ids: number[]) {
		// Fetch pages before update to return them
		const pages = await prisma.contentPage.findMany({
			where: { id: { in: ids } },
			select: { id: true, title: true },
		});

		await prisma.contentPage.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: new Date() } as any,
		});
		return pages;
	}

	async bulkRestore(ids: number[]) {
		// Fetch pages before update to return them
		const pages = await prisma.contentPage.findMany({
			where: { id: { in: ids } },
			select: { id: true, title: true },
		});

		await prisma.contentPage.updateMany({
			where: { id: { in: ids } },
			data: { deletedAt: null } as any,
		});
		return pages;
	}

	async bulkPurge(ids: number[]) {
		// Fetch pages before delete to return them
		const pages = await prisma.contentPage.findMany({
			where: { id: { in: ids } },
			select: { id: true, title: true },
		});

		await prisma.contentPage.deleteMany({
			where: { id: { in: ids } },
		});
		return pages;
	}
}

export const contentPagesService = new ContentPagesService();
