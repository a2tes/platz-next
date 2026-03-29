import { prisma } from "../config/database";
import { Status } from "@prisma/client";
import { slugify, generateUniqueSlug } from "../utils/slugify";
import { serializeMediaFile } from "../utils/serialization";
import { revalidatePaths } from "./revalidateService";

export interface CreatePhotographyItemData {
	title: string;
	description: string;
	imageId: number;
	photographerId: number;
	taxonomyIds?: number[];
	client?: string;
	year?: number | null;
	location: string;
	status?: Status;
}

export interface UpdatePhotographyItemData {
	title?: string;
	description?: string;
	photographerId?: number;
	client?: string;
	year?: number | null;
	location?: string;
	status?: Status;
	taxonomyIds?: number[];
}

export class PhotographyItemsService {
	async listByParent(params: { photographerId?: number; categoryId?: number }) {
		const where: any = { purgedAt: null, deletedAt: null } as any;
		if (params.photographerId) where.photographerId = params.photographerId;
		if (params.categoryId) {
			where.taxonomies = { some: { taxonomyId: params.categoryId } };
		}

		const items = await prisma.photography.findMany({
			where,
			orderBy: { sortOrder: "asc" },
			include: {
				image: true,
				photographer: true,
				taxonomies: { include: { taxonomy: true } },
			},
		});

		return items.map((it) => ({
			...it,
			image: serializeMediaFile(it.image),
		}));
	}

	async createItem(data: CreatePhotographyItemData) {
		const baseSlug = slugify(data.title);
		const slug = await generateUniqueSlug(baseSlug, async (s) => {
			const existing = await prisma.photography.findUnique({
				where: { slug: s },
			});
			return !!existing;
		});

		const last = await prisma.photography.findFirst({
			orderBy: { sortOrder: "desc" },
		});
		const sortOrder = (last?.sortOrder || 0) + 1;

		const item = await prisma.$transaction(async (tx) => {
			const created = await tx.photography.create({
				data: {
					title: data.title,
					slug,
					description: data.description,
					imageId: data.imageId,
					photographerId: data.photographerId,
					client: data.client ?? "",
					year: data.year,
					location: data.location ?? "",
					status: data.status ?? "DRAFT",
					sortOrder,
				},
			});

			// Create taxonomy relations
			if (data.taxonomyIds && data.taxonomyIds.length > 0) {
				await tx.photographyTaxonomy.createMany({
					data: data.taxonomyIds.map((taxonomyId) => ({ photographyId: created.id, taxonomyId })),
				});
			}

			return tx.photography.findUniqueOrThrow({
				where: { id: created.id },
				include: {
					image: true,
					photographer: true,
					taxonomies: { include: { taxonomy: true } },
				},
			});
		});

		// Revalidate if created as PUBLISHED
		try {
			if (item.status === "PUBLISHED") {
				await revalidatePaths(["/photography", `/photography/${item.slug}`]);
			}
		} catch {}

		return { ...item, image: serializeMediaFile(item.image) };
	}

	async updateItem(id: number, data: UpdatePhotographyItemData) {
		const { taxonomyIds, ...updateData } = data;
		const current = await prisma.photography.findUnique({ where: { id } });

		console.log("updateItem called with:", { id, taxonomyIds });

		// Update photography item and manage relations in a transaction
		const item = await prisma.$transaction(async (tx) => {
			// Update the main photography record
			await tx.photography.update({
				where: { id },
				data: updateData,
			});

			// Update taxonomy relations if provided
			if (taxonomyIds !== undefined) {
				console.log("Updating taxonomy relations:", taxonomyIds);
				// Delete existing relations
				await tx.photographyTaxonomy.deleteMany({ where: { photographyId: id } });
				// Create new relations
				if (taxonomyIds.length > 0) {
					const result = await tx.photographyTaxonomy.createMany({
						data: taxonomyIds.map((taxonomyId) => ({ photographyId: id, taxonomyId })),
					});
					console.log("Created taxonomy relations:", result);
				}
			}

			// Re-fetch with updated relations (use findUniqueOrThrow to guarantee non-null)
			const fetched = await tx.photography.findUniqueOrThrow({
				where: { id },
				include: {
					image: true,
					photographer: true,
					taxonomies: { include: { taxonomy: true } },
				},
			});
			console.log("Re-fetched item taxonomies:", fetched.taxonomies);
			return fetched;
		});

		try {
			const nextStatus = data.status ?? current?.status;
			const becamePublished = nextStatus === "PUBLISHED" && current?.status !== "PUBLISHED";
			const becameDraft = nextStatus === "DRAFT" && current?.status === "PUBLISHED";
			const slugChanged = !!(data as any).slug && (data as any).slug !== current?.slug;
			if (becamePublished || becameDraft || slugChanged) {
				const paths = new Set<string>(["/photography", `/photography/${item.slug}`]);
				if (slugChanged && current?.slug) paths.add(`/photography/${current.slug}`);
				await revalidatePaths(Array.from(paths));
			}
		} catch {}

		return { ...item, image: serializeMediaFile(item.image) };
	}

	async reorder(parent: { photographerId?: number; categoryId?: number }, orderedIds: number[]) {
		// Update sortOrder in a transaction
		await prisma.$transaction(
			orderedIds.map((id, index) =>
				prisma.photography.update({
					where: { id },
					data: { sortOrder: index + 1 },
				}),
			),
		);
	}

	async moveToClient(itemId: number, clientTaxonomyId: number | null) {
		await prisma.$transaction(async (tx) => {
			// Remove existing CLIENT taxonomy relations
			const clientTaxonomies = await tx.photographyTaxonomy.findMany({
				where: { photographyId: itemId },
				include: { taxonomy: true },
			});
			const clientTaxIds = clientTaxonomies.filter((pt) => pt.taxonomy.type === "CLIENT").map((pt) => pt.taxonomyId);
			if (clientTaxIds.length > 0) {
				await tx.photographyTaxonomy.deleteMany({
					where: { photographyId: itemId, taxonomyId: { in: clientTaxIds } },
				});
			}
			// Add new client taxonomy relation if provided
			if (clientTaxonomyId !== null) {
				await tx.photographyTaxonomy.create({
					data: { photographyId: itemId, taxonomyId: clientTaxonomyId },
				});
			}
		});

		// Revalidate
		try {
			await revalidatePaths(["/photography"]);
		} catch {}
	}

	async reorderGroups(photographerId: number, groupOrder: Array<{ clientId: number | null; itemIds: number[] }>) {
		let sortOrder = 1;
		const updates: Array<{ id: number; sortOrder: number }> = [];
		for (const group of groupOrder) {
			for (const itemId of group.itemIds) {
				updates.push({ id: itemId, sortOrder: sortOrder++ });
			}
		}
		await prisma.$transaction(
			updates.map((u) =>
				prisma.photography.update({
					where: { id: u.id },
					data: { sortOrder: u.sortOrder },
				}),
			),
		);
	}

	async delete(id: number) {
		return prisma.photography.delete({
			where: { id },
			include: { photographer: true, taxonomies: { include: { taxonomy: true } } },
		});
	}

	async bulkCreate(data: {
		photographerId?: number;
		taxonomyIds?: number[];

		items: Array<{
			imageId: number;
			title: string;
			description?: string;
			year?: number | null;
			location?: string;
			client?: string;
			taxonomyIds?: number[];
			photographerId?: number;
		}>;
	}) {
		const last = await prisma.photography.findFirst({
			orderBy: { sortOrder: "desc" },
		});
		let sortOrder = (last?.sortOrder || 0) + 1;

		const createdItems = [];

		for (const itemData of data.items) {
			const baseSlug = slugify(itemData.title);
			const slug = await generateUniqueSlug(baseSlug, async (s) => {
				const existing = await prisma.photography.findUnique({
					where: { slug: s },
				});
				return !!existing;
			});

			const item = await prisma.$transaction(async (tx) => {
				const created = await tx.photography.create({
					data: {
						title: itemData.title,
						slug,
						description: itemData.description ?? "",
						imageId: itemData.imageId,
						photographerId: itemData.photographerId ?? data.photographerId!,
						client: itemData.client ?? "",
						year: itemData.year ?? null,
						location: itemData.location ?? "",
						status: "PUBLISHED",
						sortOrder: sortOrder++,
					},
				});

				// Create taxonomy relations (item-level or shared)
				const taxonomyIds = itemData.taxonomyIds ?? data.taxonomyIds;
				if (taxonomyIds && taxonomyIds.length > 0) {
					await tx.photographyTaxonomy.createMany({
						data: taxonomyIds.map((taxonomyId) => ({ photographyId: created.id, taxonomyId })),
					});
				}

				return tx.photography.findUniqueOrThrow({
					where: { id: created.id },
					include: {
						image: true,
						photographer: true,
						taxonomies: { include: { taxonomy: true } },
					},
				});
			});

			createdItems.push({ ...item, image: serializeMediaFile(item.image) });
		}

		// Revalidate photography pages
		try {
			await revalidatePaths(["/photography"]);
		} catch {}

		return createdItems;
	}
}

export const photographyItemsService = new PhotographyItemsService();
