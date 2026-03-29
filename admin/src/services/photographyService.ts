import { api } from "../lib/api";
import { MediaFile } from "./mediaService";

export interface PhotoCategory {
	id: number;
	title: string;
	slug: string;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status: "DRAFT" | "PUBLISHED";
	createdAt: string;
	updatedAt: string;
}

export interface Photographer {
	id: number;
	title: string;
	slug: string;
	bio?: string;
	avatarId?: number;
	avatar?: MediaFile;
	coverImageId?: number;
	coverImage?: MediaFile;
	groupByClient: boolean;
	tags?: string[];
	metaDescription?: string;
	metaKeywords?: string;
	imagesCount?: number;
	activeImagesCount?: number;
	previewImageId?: number;
	previewImage?: MediaFile;
	status: "DRAFT" | "PUBLISHED";
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
	creator?: {
		name: string;
	};
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
		timestamp: string;
	};
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	meta: { timestamp: string };
}

export interface CountsResponse {
	all: number;
	published?: number;
	draft?: number;
	mine?: number;
	trash: number;
}

export class PhotographyService {
	// Categories
	static async createCategory(data: {
		title: string;
		status?: "DRAFT" | "PUBLISHED";
		metaDescription?: string;
		metaKeywords?: string;
	}): Promise<PhotoCategory> {
		const res = await api.post<ApiResponse<PhotoCategory>>("/api/photography/categories", data);
		return res.data.data;
	}

	static async updateCategory(
		id: number,
		data: { title?: string; status?: "DRAFT" | "PUBLISHED"; metaDescription?: string; metaKeywords?: string },
	): Promise<PhotoCategory> {
		const res = await api.put<ApiResponse<PhotoCategory>>(`/api/photography/categories/${id}`, data);
		return res.data.data;
	}

	static async getCategories(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "title" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED" | "ALL";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<PhotoCategory>> {
		const sp = new URLSearchParams();
		if (params.page) sp.append("page", String(params.page));
		if (params.limit) sp.append("limit", String(params.limit));
		if (params.search) sp.append("search", params.search);
		if (params.sortBy) sp.append("sortBy", params.sortBy);
		if (params.sortOrder) sp.append("sortOrder", params.sortOrder);
		if (params.status) sp.append("status", params.status);
		if (params.mine) sp.append("mine", "true");
		const res = await api.get<PaginatedResponse<PhotoCategory>>(`/api/photography/categories?${sp}`);
		return res.data;
	}

	static async getCategoriesCounts(): Promise<CountsResponse> {
		const res = await api.get<ApiResponse<CountsResponse>>(`/api/photography/categories/counts`);
		return res.data.data;
	}

	static async getCategory(id: number): Promise<PhotoCategory> {
		const res = await api.get<ApiResponse<PhotoCategory>>(`/api/photography/categories/${id}`);
		return res.data.data;
	}

	static async searchCategories(
		query: string,
		limit: number = 10,
	): Promise<Array<{ id: number; name: string; slug: string }>> {
		const res = await api.get(`/api/photography/categories/search?q=${encodeURIComponent(query)}&limit=${limit}`);
		return res.data.data;
	}

	static async findOrCreateCategory(name: string): Promise<{ id: number; name: string; slug: string }> {
		const res = await api.post(`/api/photography/categories/find-or-create`, { name });
		return res.data.data;
	}

	static async deleteCategory(id: number): Promise<void> {
		await api.delete(`/api/photography/categories/${id}`);
	}

	static async publishCategory(id: number): Promise<void> {
		await api.patch(`/api/photography/categories/${id}/publish`);
	}

	static async unpublishCategory(id: number): Promise<void> {
		await api.patch(`/api/photography/categories/${id}/unpublish`);
	}

	static async getTrashedCategories(
		params: { page?: number; limit?: number; search?: string } = {},
	): Promise<PaginatedResponse<PhotoCategory>> {
		const sp = new URLSearchParams();
		if (params.page) sp.append("page", String(params.page));
		if (params.limit) sp.append("limit", String(params.limit));
		if (params.search) sp.append("search", params.search);
		const res = await api.get<PaginatedResponse<PhotoCategory>>(`/api/photography/categories/trash?${sp}`);
		return res.data;
	}

	static async restoreCategory(id: number): Promise<void> {
		await api.post(`/api/photography/categories/${id}/restore`);
	}

	static async purgeCategory(id: number): Promise<void> {
		await api.post(`/api/photography/categories/${id}/purge`);
	}

	// Photographers
	static async createPhotographer(data: {
		title: string;
		bio?: string;
		tags?: string[];
		avatarId?: number;
		coverImageId?: number;
		previewImageId?: number;
		metaDescription?: string;
		metaKeywords?: string;
		status?: "DRAFT" | "PUBLISHED";
	}): Promise<Photographer> {
		const res = await api.post<ApiResponse<Photographer>>(`/api/photography/photographers`, data);
		return res.data.data;
	}

	static async updatePhotographer(
		id: number,
		data: {
			title?: string;
			bio?: string;
			tags?: string[];
			avatarId?: number;
			coverImageId?: number;
			previewImageId?: number;
			metaDescription?: string;
			metaKeywords?: string;
			status?: "DRAFT" | "PUBLISHED";
		},
	): Promise<Photographer> {
		const res = await api.put<ApiResponse<Photographer>>(`/api/photography/photographers/${id}`, data);
		return res.data.data;
	}

	static async updatePhotographerTitle(id: number, title: string): Promise<Photographer> {
		const res = await api.patch<ApiResponse<Photographer>>(`/api/photography/photographers/${id}/title`, { title });
		return res.data.data;
	}

	static async getPhotographers(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "title" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Photographer>> {
		const sp = new URLSearchParams();
		if (params.page) sp.append("page", String(params.page));
		if (params.limit) sp.append("limit", String(params.limit));
		if (params.search) sp.append("search", params.search);
		if (params.sortBy) sp.append("sortBy", params.sortBy);
		if (params.sortOrder) sp.append("sortOrder", params.sortOrder);
		if (params.status) sp.append("status", params.status);
		if (params.mine) sp.append("mine", "true");
		const res = await api.get<PaginatedResponse<Photographer>>(`/api/photography/photographers?${sp}`);
		return res.data;
	}

	static async reorderPhotographers(orderedIds: number[]): Promise<void> {
		await api.post(`/api/photography/photographers/reorder`, { orderedIds });
	}

	// Bulk operations - Photographers
	static async bulkDeletePhotographers(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/photography/photographers/bulk/delete`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.deletePhotographer(id)));
				return;
			}
			throw err;
		}
	}

	static async bulkPurgePhotographers(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/photography/photographers/bulk/purge`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.purgePhotographer(id)));
				return;
			}
			throw err;
		}
	}

	static async bulkPublishPhotographers(ids: number[]): Promise<{
		publishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}> {
		try {
			const res = await api.post<
				ApiResponse<{
					publishedIds: number[];
					skipped: Array<{ id: number; reason: string }>;
				}>
			>(`/api/photography/photographers/bulk/publish`, { ids });
			return {
				publishedIds: res.data.data.publishedIds,
				failed: res.data.data.skipped.map((s) => ({
					id: s.id,
					title: `ID ${s.id}`,
					error: s.reason,
				})),
			};
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				// Fallback to individual requests
				const results = await Promise.allSettled(ids.map((id) => this.publishPhotographer(id)));
				const publishedIds: number[] = [];
				const failed: Array<{ id: number; title: string; error: string }> = [];

				results.forEach((r, index) => {
					if (r.status === "fulfilled") {
						publishedIds.push(r.value.id);
					} else {
						failed.push({
							id: ids[index],
							title: `ID ${ids[index]}`,
							error: r.reason?.message || "Unknown error",
						});
					}
				});
				return { publishedIds, failed };
			}
			throw err;
		}
	}

	static async bulkUnpublishPhotographers(ids: number[]): Promise<{
		unpublishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}> {
		try {
			const res = await api.post<
				ApiResponse<{
					unpublishedIds: number[];
					skipped: Array<{ id: number; reason: string }>;
				}>
			>(`/api/photography/photographers/bulk/unpublish`, { ids });
			return {
				unpublishedIds: res.data.data.unpublishedIds,
				failed: res.data.data.skipped.map((s) => ({
					id: s.id,
					title: `ID ${s.id}`,
					error: s.reason,
				})),
			};
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				// Fallback to individual requests
				const results = await Promise.allSettled(ids.map((id) => this.unpublishPhotographer(id)));
				const unpublishedIds: number[] = [];
				const failed: Array<{ id: number; title: string; error: string }> = [];

				results.forEach((r, index) => {
					if (r.status === "fulfilled") {
						unpublishedIds.push(r.value.id);
					} else {
						failed.push({
							id: ids[index],
							title: `ID ${ids[index]}`,
							error: r.reason?.message || "Unknown error",
						});
					}
				});
				return { unpublishedIds, failed };
			}
			throw err;
		}
	}

	static async reorderCategories(orderedIds: number[]): Promise<void> {
		await api.post(`/api/photography/categories/reorder`, { orderedIds });
	}

	// Bulk operations - Photo Categories
	static async bulkDeleteCategories(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/photography/categories/bulk/delete`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.deleteCategory(id)));
				return;
			}
			throw err;
		}
	}

	static async bulkPurgeCategories(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/photography/categories/bulk/purge`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.purgeCategory(id)));
				return;
			}
			throw err;
		}
	}

	static async getPhotographer(id: number): Promise<Photographer> {
		const res = await api.get<ApiResponse<Photographer>>(`/api/photography/photographers/${id}`);
		return res.data.data;
	}

	static async getPhotographersCounts(): Promise<CountsResponse> {
		const res = await api.get<ApiResponse<CountsResponse>>(`/api/photography/photographers/counts`);
		return res.data.data;
	}

	static async deletePhotographer(id: number): Promise<void> {
		await api.delete(`/api/photography/photographers/${id}`);
	}

	static async publishPhotographer(id: number): Promise<Photographer> {
		const res = await api.patch<ApiResponse<Photographer>>(`/api/photography/photographers/${id}/publish`);
		return res.data.data;
	}

	static async unpublishPhotographer(id: number): Promise<Photographer> {
		const res = await api.patch<ApiResponse<Photographer>>(`/api/photography/photographers/${id}/unpublish`);
		return res.data.data;
	}

	static async getTrashedPhotographers(
		params: { page?: number; limit?: number; search?: string } = {},
	): Promise<PaginatedResponse<Photographer>> {
		const sp = new URLSearchParams();
		if (params.page) sp.append("page", String(params.page));
		if (params.limit) sp.append("limit", String(params.limit));
		if (params.search) sp.append("search", params.search);
		const res = await api.get<PaginatedResponse<Photographer>>(`/api/photography/photographers/trash?${sp}`);
		return res.data;
	}

	static async restorePhotographer(id: number): Promise<void> {
		await api.post(`/api/photography/photographers/${id}/restore`);
	}

	static async purgePhotographer(id: number): Promise<void> {
		await api.post(`/api/photography/photographers/${id}/purge`);
	}
}
