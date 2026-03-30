import { api } from "../lib/api";
import { MediaFile } from "./mediaService";

export interface Revision {
	id: number;
	version: number;
	createdAt: string;
	updatedAt?: string;
	user?: string;
	userId?: number;
	workId?: number;
	payload?: Record<string, unknown>;
	revertedFromId?: number | null;
}

export interface Work {
	id: number;
	title: string;
	slug: string;
	shortDescription: string | null;
	subtitle: string | null;
	caseStudy: string | null;
	client: string; // @deprecated - use clients relation
	tags: string[];
	publicationDate?: string | null;
	year?: number | null;
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
	createdBy?: number;
	creator?: {
		id: number;
		name: string;
		email: string;
	};
	videoFile?: MediaFile;
	previewImage?: MediaFile;
	revisions?: Revision[];
	taxonomies?: Array<{
		taxonomy: { id: number; type: string; name: string; slug: string };
	}>;
}

export interface CreateWorkData {
	title: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string; // @deprecated
	tags: string[];
	publicationDate?: string | null;
	year?: number | null;
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
	taxonomyIds?: number[];
}

export interface UpdateWorkData {
	title?: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string; // @deprecated
	tags?: string[];
	publicationDate?: string | null;
	year?: number | null;
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status?: "DRAFT" | "PUBLISHED";
	taxonomyIds?: number[];
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
	meta: {
		timestamp: string;
	};
}

export interface WorksCounts {
	all: number;
	mine: number;
	published: number;
	draft: number;
	unlisted?: number;
	trash: number;
}

export class WorksService {
	// Works API methods
	static async createWork(data: CreateWorkData): Promise<Work> {
		const response = await api.post<ApiResponse<Work>>("/api/works", data);
		return response.data.data;
	}

	static async getWorks(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			status?: "DRAFT" | "PUBLISHED" | "ALL";
			sortBy?: "title" | "client" | "createdAt" | "updatedAt" | "sortOrder";
			sortOrder?: "asc" | "desc";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Work>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.status) searchParams.append("status", params.status);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.mine) searchParams.append("mine", String(params.mine));

		const response = await api.get<PaginatedResponse<Work>>(`/api/works?${searchParams}`);
		return response.data;
	}

	static async getWorksCounts(): Promise<WorksCounts> {
		const response = await api.get<ApiResponse<WorksCounts>>("/api/works/counts");
		return response.data.data;
	}

	static async getWork(id: number): Promise<Work> {
		const response = await api.get<ApiResponse<Work>>(`/api/works/${id}`);
		return response.data.data;
	}

	static async updateWorkTitle(id: number, title: string): Promise<Work> {
		const response = await api.patch<ApiResponse<Work>>(`/api/works/${id}/title`, { title });
		return response.data.data;
	}

	static async updateWork(id: number, data: UpdateWorkData): Promise<Work> {
		const response = await api.put<ApiResponse<Work>>(`/api/works/${id}`, data);
		return response.data.data;
	}

	static async deleteWork(id: number): Promise<void> {
		await api.delete(`/api/works/${id}`);
	}

	static async publishWork(id: number): Promise<Work> {
		const response = await api.patch<ApiResponse<Work>>(`/api/works/${id}/publish`);
		return response.data.data;
	}

	static async unpublishWork(id: number): Promise<Work> {
		const response = await api.patch<ApiResponse<Work>>(`/api/works/${id}/unpublish`);
		return response.data.data;
	}

	static async reorderWorks(workIds: number[]): Promise<{ message: string; count: number }> {
		const response = await api.put<ApiResponse<{ message: string; count: number }>>("/api/works/reorder", {
			workIds,
		});
		return response.data.data;
	}

	// Bulk operations - Works
	static async bulkDeleteWorks(ids: number[]): Promise<{
		deletedIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}> {
		try {
			const response = await api.post<
				ApiResponse<{
					deletedIds: number[];
					skipped: Array<{ id: number; reason: string }>;
				}>
			>(`/api/works/bulk/delete`, { ids });
			return response.data.data;
		} catch (err: unknown) {
			// Fallback to per-item when bulk endpoint is not available
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.deleteWork(id)));
				return { deletedIds: ids, skipped: [] };
			}
			throw err;
		}
	}

	static async bulkPurgeWorks(ids: number[]): Promise<{
		purgedIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}> {
		try {
			const response = await api.post<
				ApiResponse<{
					purgedIds: number[];
					skipped: Array<{ id: number; reason: string }>;
				}>
			>(`/api/works/bulk/purge`, { ids });
			return response.data.data;
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.purgeWork(id)));
				return { purgedIds: ids, skipped: [] };
			}
			throw err;
		}
	}

	static async bulkPublishWorks(ids: number[]): Promise<{
		publishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				publishedIds: number[];
				failed: Array<{ id: number; title: string; error: string }>;
			}>
		>(`/api/works/bulk/publish`, { ids });
		return response.data.data;
	}

	static async bulkUnpublishWorks(ids: number[]): Promise<{
		unpublishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				unpublishedIds: number[];
				failed: Array<{ id: number; title: string; error: string }>;
			}>
		>(`/api/works/bulk/unpublish`, { ids });
		return response.data.data;
	}

	// Trash methods for Works
	static async getTrashedWorks(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: string;
			sortOrder?: "asc" | "desc";
		} = {},
	): Promise<PaginatedResponse<Work>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);

		const response = await api.get<PaginatedResponse<Work>>(`/api/works/trash?${searchParams}`);
		return response.data;
	}

	static async restoreWork(id: number): Promise<Work> {
		const response = await api.post<ApiResponse<Work>>(`/api/works/${id}/restore`);
		return response.data.data;
	}

	static async purgeWork(id: number): Promise<void> {
		await api.post(`/api/works/${id}/purge`);
	}

	static async revertToRevision(workId: number, revisionId: number): Promise<Work> {
		const response = await api.post<ApiResponse<Work>>(`/api/works/${workId}/revisions/${revisionId}/revert`);
		return response.data.data;
	}
}
