import { api } from "@/lib/api";
import { MediaFile } from "./mediaService";

// Entity types for relations
export interface ClientEntity {
	id: number;
	name: string;
	slug: string;
}

export interface StarringEntity {
	id: number;
	title: string; // Starring uses 'title' not 'name'
	name?: string; // Mapped from title in search endpoint
	slug: string;
}

// Junction table types (as returned from API)
export interface PhotographyClientJunction {
	photographyId: number;
	clientId: number;
	client: ClientEntity;
}

export interface PhotographyStarringJunction {
	photographyId: number;
	starringId: number;
	starring: StarringEntity;
}

export interface PhotographyCategoryJunction {
	photographyId: number;
	categoryId: number;
	category: {
		id: number;
		title: string;
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
	// New relation fields (junction table format from API)
	clients?: PhotographyClientJunction[];
	starrings?: PhotographyStarringJunction[];
	categories?: PhotographyCategoryJunction[];
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
		categoryIds?: number[];
		clientIds?: number[];
		starringIds?: number[];
		items: Array<{
			imageId: number;
			title?: string;
			description?: string;
			year?: number;
			location?: string;
			categoryIds?: number[];
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

	static async moveToClient(itemId: number, clientId: number | null) {
		await api.patch<{ success: boolean }>(`/api/photography/items/${itemId}/move-to-client`, { clientId });
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
