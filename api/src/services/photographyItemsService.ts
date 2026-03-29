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
	categoryIds?: number[];
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
	clientIds?: number[];
	categoryIds?: number[];
}

export class PhotographyItemsService {
	async listByParent(params: { photographerId?: number; categoryId?: number }) {
		const where: any = { purgedAt: null, deletedAt: null } as any;
		if (params.photographerId) where.photographerId = params.photographerId;
		if (params.categoryId) {
			where.categories = { some: { categoryId: params.categoryId } };
		}

		const items = await prisma.photography.findMany({
			where,
			orderBy: { sortOrder: "asc" },
			include: {
				image: true,
				photographer: true,
				categories: { include: { category: true } },
				clients: { include: { client: true } },
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

			// Create category relations
			if (data.categoryIds && data.categoryIds.length > 0) {
				await tx.photographyCategory.createMany({
					data: data.categoryIds.map((categoryId) => ({ photographyId: created.id, categoryId })),
				});
			}

			return tx.photography.findUniqueOrThrow({
				where: { id: created.id },
				include: {
					image: true,
					photographer: true,
					categories: { include: { category: true } },
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
		const { clientIds, categoryIds, ...updateData } = data;
		const current = await prisma.photography.findUnique({ where: { id } });

		console.log("updateItem called with:", { id, clientIds, categoryIds });

		// Update photography item and manage relations in a transaction
		const item = await prisma.$transaction(async (tx) => {
			// Update the main photography record
			await tx.photography.update({
				where: { id },
				data: updateData,
			});

			// Update client relations if provided
			if (clientIds !== undefined) {
				console.log("Updating client relations:", clientIds);
				// Delete existing relations
				await tx.photographyClient.deleteMany({ where: { photographyId: id } });
				// Create new relations
				if (clientIds.length > 0) {
					const result = await tx.photographyClient.createMany({
						data: clientIds.map((clientId) => ({ photographyId: id, clientId })),
					});
					console.log("Created client relations:", result);
				}
			}

			// Update category relations if provided
			if (categoryIds !== undefined) {
				console.log("Updating category relations:", categoryIds);
				await tx.photographyCategory.deleteMany({ where: { photographyId: id } });
				if (categoryIds.length > 0) {
					const result = await tx.photographyCategory.createMany({
						data: categoryIds.map((categoryId) => ({ photographyId: id, categoryId })),
					});
					console.log("Created category relations:", result);
				}
			}

			// Re-fetch with updated relations (use findUniqueOrThrow to guarantee non-null)
			const fetched = await tx.photography.findUniqueOrThrow({
				where: { id },
				include: {
					image: true,
					photographer: true,
					categories: { include: { category: true } },
					clients: { include: { client: true } },
				},
			});
			console.log("Re-fetched item clients:", fetched.clients);
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

	async moveToClient(itemId: number, clientId: number | null) {
		await prisma.$transaction(async (tx) => {
			// Remove all existing client relations
			await tx.photographyClient.deleteMany({ where: { photographyId: itemId } });
			// Add new client relation if provided
			if (clientId !== null) {
				await tx.photographyClient.create({
					data: { photographyId: itemId, clientId },
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
			include: { photographer: true, categories: { include: { category: true } } },
		});
	}

	async bulkCreate(data: {
		photographerId?: number;
		categoryIds?: number[];
		clientIds?: number[];

		items: Array<{
			imageId: number;
			title: string;
			description?: string;
			year?: number | null;
			location?: string;
			client?: string;
			categoryIds?: number[];
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

				// Create category relations
				const categoryIds = itemData.categoryIds ?? data.categoryIds;
				if (categoryIds && categoryIds.length > 0) {
					await tx.photographyCategory.createMany({
						data: categoryIds.map((categoryId) => ({ photographyId: created.id, categoryId })),
					});
				}

				// Create client relations (shared across all items)
				if (data.clientIds && data.clientIds.length > 0) {
					await tx.photographyClient.createMany({
						data: data.clientIds.map((clientId) => ({ photographyId: created.id, clientId })),
					});
				}

				return tx.photography.findUniqueOrThrow({
					where: { id: created.id },
					include: {
						image: true,
						photographer: true,
						categories: { include: { category: true } },
						clients: { include: { client: true } },
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
