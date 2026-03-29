import { api } from "@/lib/api";
import { MediaFile } from "./mediaService";

// Taxonomy junction type (as returned from API)
export interface PhotographyTaxonomyJunction {
	photographyId: number;
	taxonomyId: number;
	taxonomy: {
		id: number;
		type: string;
		name: string;
		slug: string;
	};
}

export interface PhotographyItem {
	id: number;
	title: string;
	slug: string;
	description: string;
	imageId: number;
	image?: MediaFile;
	photographerId: number;
	categoryId: number;
	// Legacy fields (deprecated)
	client?: string;
	// New taxonomy relations
	taxonomies?: PhotographyTaxonomyJunction[];
	year?: number;
	location?: string;
	sortOrder: number;
	status: "DRAFT" | "PUBLISHED";
	createdAt: string;
	updatedAt: string;
}

export interface PaginatedResponse<T> {
	success: boolean;
	data: T[];
	meta: {
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	};
}

export class PhotographyItemsService {
	static async createItem(data: {
		title: string;
		description: string;
		imageId: number;
		photographerId: number;
		categoryId: number;
		client?: string;
		year: number;
		location: string;
		status?: "DRAFT" | "PUBLISHED";
	}) {
		const res = await api.post<{ success: boolean; data: PhotographyItem }>("/api/photography/items", data);
		return res.data.data;
	}
	static async listByPhotographer(photographerId: number) {
		const res = await api.get<PaginatedResponse<PhotographyItem>>(
			`/api/photography/items?photographerId=${photographerId}`,
		);
		return res.data;
	}

	static async listByCategory(categoryId: number) {
		const res = await api.get<PaginatedResponse<PhotographyItem>>(`/api/photography/items?categoryId=${categoryId}`);
		return res.data;
	}

	static async bulkCreate(params: {
		photographerId?: number;
		taxonomyIds?: number[];
		items: Array<{
			imageId: number;
			title?: string;
			description?: string;
			year?: number;
			location?: string;
			taxonomyIds?: number[];
			photographerId?: number;
		}>;
	}) {
		const res = await api.post<{ success: boolean; data: PhotographyItem[] }>("/api/photography/items/bulk", params);
		return res.data.data;
	}

	static async updateItem(id: number, data: Partial<PhotographyItem>) {
		const res = await api.put<{ success: boolean; data: PhotographyItem }>(`/api/photography/items/${id}`, data);
		return res.data.data;
	}

	static async reorder(params: { parentType: "photographer" | "category"; parentId: number; orderedIds: number[] }) {
		await api.post<{ success: boolean }>("/api/photography/items/reorder", params);
	}

	static async moveToClient(itemId: number, clientTaxonomyId: number | null) {
		await api.patch<{ success: boolean }>(`/api/photography/items/${itemId}/move-to-client`, { clientTaxonomyId });
	}

	static async reorderGroups(
		photographerId: number,
		groupOrder: Array<{ clientId: number | null; itemIds: number[] }>,
	) {
		await api.post<{ success: boolean }>("/api/photography/items/reorder-groups", {
			photographerId,
			groupOrder,
		});
	}

	static async deleteItem(id: number) {
		await api.delete(`/api/photography/items/${id}`);
	}
}
