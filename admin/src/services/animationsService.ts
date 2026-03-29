import { api } from "../lib/api";
import { MediaFile } from "./mediaService";

export interface AnimationRevision {
	id: number;
	version: number;
	createdAt: string;
	updatedAt?: string;
	user?: string;
	userId?: number;
	animationId?: number;
	payload?: Record<string, unknown>;
	revertedFromId?: number | null;
}

export interface Animation {
	id: number;
	title: string;
	slug: string;
	shortDescription: string | null;
	client: string;
	tags: string[];
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
	revisions?: AnimationRevision[];
}

export interface CreateAnimationData {
	title: string;
	shortDescription?: string;
	client: string;
	tags: string[];
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
}

export interface UpdateAnimationData {
	title?: string;
	shortDescription?: string;
	client?: string;
	tags?: string[];
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status?: "DRAFT" | "PUBLISHED";
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

export interface AnimationsCounts {
	all: number;
	mine: number;
	published: number;
	draft: number;
	trash: number;
}

export class AnimationsService {
	// Animations API methods
	static async createAnimation(data: CreateAnimationData): Promise<Animation> {
		const response = await api.post<ApiResponse<Animation>>("/api/animations", data);
		return response.data.data;
	}

	static async getAnimations(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			status?: "DRAFT" | "PUBLISHED" | "ALL";
			sortBy?: "title" | "client" | "createdAt" | "updatedAt" | "sortOrder";
			sortOrder?: "asc" | "desc";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Animation>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.status) searchParams.append("status", params.status);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.mine) searchParams.append("mine", String(params.mine));

		const response = await api.get<PaginatedResponse<Animation>>(`/api/animations?${searchParams}`);
		return response.data;
	}

	static async getAnimationsCounts(): Promise<AnimationsCounts> {
		const response = await api.get<ApiResponse<AnimationsCounts>>("/api/animations/counts");
		return response.data.data;
	}

	static async getAnimation(id: number): Promise<Animation> {
		const response = await api.get<ApiResponse<Animation>>(`/api/animations/${id}`);
		return response.data.data;
	}

	static async updateAnimationTitle(id: number, title: string): Promise<Animation> {
		const response = await api.patch<ApiResponse<Animation>>(`/api/animations/${id}/title`, { title });
		return response.data.data;
	}

	static async updateAnimation(id: number, data: UpdateAnimationData): Promise<Animation> {
		const response = await api.put<ApiResponse<Animation>>(`/api/animations/${id}`, data);
		return response.data.data;
	}

	static async deleteAnimation(id: number): Promise<void> {
		await api.delete(`/api/animations/${id}`);
	}

	static async publishAnimation(id: number): Promise<Animation> {
		const response = await api.patch<ApiResponse<Animation>>(`/api/animations/${id}/publish`);
		return response.data.data;
	}

	static async unpublishAnimation(id: number): Promise<Animation> {
		const response = await api.patch<ApiResponse<Animation>>(`/api/animations/${id}/unpublish`);
		return response.data.data;
	}

	static async reorderAnimations(animationIds: number[]): Promise<{ message: string; count: number }> {
		const response = await api.put<ApiResponse<{ message: string; count: number }>>("/api/animations/reorder", {
			animationIds,
		});
		return response.data.data;
	}

	// Trash/Restore/Purge operations
	static async trashAnimation(id: number): Promise<void> {
		await api.post(`/api/animations/${id}/trash`);
	}

	static async restoreAnimation(id: number): Promise<void> {
		await api.post(`/api/animations/${id}/restore`);
	}

	static async purgeAnimation(id: number): Promise<void> {
		await api.post(`/api/animations/${id}/purge`);
	}

	static async getTrashedAnimations(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "title" | "client" | "createdAt" | "updatedAt" | "sortOrder";
			sortOrder?: "asc" | "desc";
		} = {},
	): Promise<PaginatedResponse<Animation>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);

		const response = await api.get<PaginatedResponse<Animation>>(`/api/animations/trash?${searchParams}`);
		return response.data;
	}

	// Bulk operations
	static async bulkDeleteAnimations(ids: number[]): Promise<{
		deletedIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}> {
		try {
			const response = await api.post<
				ApiResponse<{
					deletedIds: number[];
					skipped: Array<{ id: number; reason: string }>;
				}>
			>(`/api/animations/bulk/delete`, { ids });
			return response.data.data;
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.deleteAnimation(id)));
				return { deletedIds: ids, skipped: [] };
			}
			throw err;
		}
	}

	static async bulkPurgeAnimations(ids: number[]): Promise<{
		purgedIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}> {
		try {
			const response = await api.post<
				ApiResponse<{
					purgedIds: number[];
					skipped: Array<{ id: number; reason: string }>;
				}>
			>(`/api/animations/bulk/purge`, { ids });
			return response.data.data;
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.purgeAnimation(id)));
				return { purgedIds: ids, skipped: [] };
			}
			throw err;
		}
	}

	static async bulkPublishAnimations(ids: number[]): Promise<{
		publishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				publishedIds: number[];
				failed: Array<{ id: number; title: string; error: string }>;
			}>
		>(`/api/animations/bulk/publish`, { ids });
		return response.data.data;
	}

	static async bulkUnpublishAnimations(ids: number[]): Promise<{
		unpublishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}> {
		const response = await api.post<
			ApiResponse<{
				unpublishedIds: number[];
				failed: Array<{ id: number; title: string; error: string }>;
			}>
		>(`/api/animations/bulk/unpublish`, { ids });
		return response.data.data;
	}

	static async bulkRestoreAnimations(ids: number[]): Promise<{
		restoredIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}> {
		const results = await Promise.all(
			ids.map(async (id) => {
				try {
					await this.restoreAnimation(id);
					return { id, restored: true };
				} catch {
					return { id, restored: false, reason: "Failed to restore" };
				}
			}),
		);

		return {
			restoredIds: results.filter((r) => r.restored).map((r) => r.id),
			skipped: results
				.filter((r) => !r.restored)
				.map((r) => ({ id: r.id, reason: (r as { reason?: string }).reason || "Unknown error" })),
		};
	}

	// Revisions
	static async revertToRevision(animationId: number, revisionId: number): Promise<Animation> {
		const response = await api.post<ApiResponse<Animation>>(
			`/api/animations/${animationId}/revisions/${revisionId}/revert`,
		);
		return response.data.data;
	}
}
