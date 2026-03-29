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

export interface Director {
	id: number;
	title: string;
	slug: string;
	shortDescription: string;
	biography: string;
	links?: Array<{ title: string; url: string }>;
	avatarId?: number;
	avatar?: MediaFile;
	ogImageId?: number | null;
	heroWorkId?: number | null;
	heroMediaId?: number | null;
	heroVideo?: {
		cropSettings?: { x: number; y: number; width: number; height: number; aspect: number; aspectLabel?: string } | null;
		trimSettings?: { startTime: number; endTime: number } | null;
		processedVideo?: {
			status: string;
			url?: string | null;
			thumbnailUrl?: string | null;
			error?: string | null;
			settingsHash?: string;
			clipJobId?: string;
		} | null;
	} | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
	publishedAt?: string | null;
	createdBy?: number | null;
	creator?: { id: number; name: string; email: string } | null;
	createdAt: string;
	updatedAt: string;
	works?: Array<{
		work: {
			id: number;
			title: string;
			status: "DRAFT" | "PUBLISHED";
		};
	}>;
}

export interface DirectorWorkLink {
	workId: number;
	directorId: number;
	sortOrder: number;
	work: {
		id: number;
		title: string;
		status: "DRAFT" | "PUBLISHED";
		slug: string;
		previewImage?: MediaFile;
		videoFile?: MediaFile;
	};
}

export interface Starring {
	id: number;
	title: string;
	slug: string;
	shortDescription: string;
	biography: string;
	avatarId?: number;
	avatar?: MediaFile;
	status: "DRAFT" | "PUBLISHED";
	publishedAt?: string;
	createdBy?: number;
	creator?: {
		id: number;
		name: string;
		email: string;
	};
	createdAt: string;
	updatedAt: string;
	_count?: {
		works: number;
		photography: number;
	};
	works?: Array<{
		work: {
			id: number;
			title: string;
			status: "DRAFT" | "PUBLISHED";
		};
	}>;
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
	directors: Array<{
		director: Director;
	}>;
	starrings: Array<{
		starring: Starring;
	}>;
	clients?: Array<{
		client: { id: number; name: string; slug: string };
	}>;
	disciplines?: Array<{
		discipline: { id: number; name: string; slug: string };
	}>;
	sectors?: Array<{
		sector: { id: number; name: string; slug: string };
	}>;
}

export interface CreateWorkData {
	title: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string; // @deprecated
	tags: string[];
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
	directorIds: number[];
	starringIds: number[];
	clientIds?: number[];
	disciplineIds?: number[];
	sectorIds?: number[];
}

export interface UpdateWorkData {
	title?: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string; // @deprecated
	tags?: string[];
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status?: "DRAFT" | "PUBLISHED";
	directorIds?: number[];
	starringIds?: number[];
	clientIds?: number[];
	disciplineIds?: number[];
	sectorIds?: number[];
}

export interface CreateDirectorData {
	title: string;
	slug?: string;
	shortDescription: string;
	biography: string;
	links?: Array<{ title: string; url: string }>;
	avatarId?: number;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
}

export interface UpdateDirectorData {
	title?: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	links?: Array<{ title: string; url: string }>;
	avatarId?: number;
	ogImageId?: number | null;
	metaDescription?: string;
	metaKeywords?: string;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
}

export interface CreateStarringData {
	title: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	avatarId?: number;
}

export interface UpdateStarringData {
	title?: string;
	slug?: string;
	shortDescription?: string;
	biography?: string;
	avatarId?: number;
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

	// Directors API methods
	static async createDirector(data: CreateDirectorData): Promise<Director> {
		const response = await api.post<ApiResponse<Director>>("/api/works/directors", data);
		return response.data.data;
	}

	static async getDirectors(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "title" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED" | "ALL";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Director>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", String(params.mine));

		const response = await api.get<PaginatedResponse<Director>>(`/api/works/directors?${searchParams}`);
		return response.data;
	}

	static async getDirector(id: number): Promise<Director> {
		const response = await api.get<ApiResponse<Director>>(`/api/works/directors/${id}`);
		return response.data.data;
	}

	static async getDirectorWorks(directorId: number): Promise<DirectorWorkLink[]> {
		const response = await api.get<ApiResponse<DirectorWorkLink[]>>(`/api/works/directors/${directorId}/works`);
		return response.data.data;
	}

	static async reorderDirectorWorks(
		directorId: number,
		workIds: number[],
	): Promise<{ message: string; count: number }> {
		const response = await api.put<ApiResponse<{ message: string; count: number }>>(
			`/api/works/directors/${directorId}/works/reorder`,
			{ workIds },
		);
		return response.data.data;
	}

	static async getDirectorWorksPaginated(
		directorId: number,
		params?: { page?: number; limit?: number; search?: string },
	): Promise<PaginatedResponse<any>> {
		const response = await api.get<PaginatedResponse<any>>(`/api/works/directors/${directorId}/works/paginated`, {
			params,
		});
		return response.data;
	}

	// Hero Video
	static async setHeroVideo(
		directorId: number,
		data: { heroWorkId: number; cropSettings?: any; trimSettings?: any },
	): Promise<void> {
		await api.put(`/api/works/directors/${directorId}/hero-video`, data);
	}

	static async processHeroVideo(
		directorId: number,
		data: { cropSettings?: any; trimSettings?: any },
	): Promise<{ jobId: string; settingsHash: string; status: string }> {
		const response = await api.post<ApiResponse<{ jobId: string; settingsHash: string; status: string }>>(
			`/api/works/directors/${directorId}/hero-video/process`,
			data,
		);
		return response.data.data;
	}

	static async removeHeroVideo(directorId: number): Promise<void> {
		await api.delete(`/api/works/directors/${directorId}/hero-video`);
	}

	static async updateDirector(id: number, data: UpdateDirectorData): Promise<Director> {
		const response = await api.put<ApiResponse<Director>>(`/api/works/directors/${id}`, data);
		return response.data.data;
	}

	static async deleteDirector(id: number): Promise<void> {
		await api.delete(`/api/works/directors/${id}`);
	}

	// Bulk operations - Directors
	static async bulkDeleteDirectors(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/works/directors/bulk/delete`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.deleteDirector(id)));
				return;
			}
			throw err;
		}
	}

	static async bulkPurgeDirectors(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/works/directors/bulk/purge`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.purgeDirector(id)));
				return;
			}
			throw err;
		}
	}

	static async publishDirector(id: number): Promise<void> {
		await api.patch(`/api/works/directors/${id}/publish`);
	}

	static async unpublishDirector(id: number): Promise<void> {
		await api.patch(`/api/works/directors/${id}/unpublish`);
	}

	// Starrings API methods
	static async createStarring(data: CreateStarringData): Promise<Starring> {
		const response = await api.post<ApiResponse<Starring>>("/api/works/starrings", data);
		return response.data.data;
	}

	static async getStarrings(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "title" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Starring>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", "true");

		const response = await api.get<PaginatedResponse<Starring>>(`/api/works/starrings?${searchParams}`);
		return response.data;
	}

	static async getStarring(id: number): Promise<Starring> {
		const response = await api.get<ApiResponse<Starring>>(`/api/works/starrings/${id}`);
		return response.data.data;
	}

	static async updateStarring(id: number, data: UpdateStarringData): Promise<Starring> {
		const response = await api.put<ApiResponse<Starring>>(`/api/works/starrings/${id}`, data);
		return response.data.data;
	}

	static async deleteStarring(id: number): Promise<void> {
		await api.delete(`/api/works/starrings/${id}`);
	}

	// Bulk operations - Starrings
	static async bulkDeleteStarrings(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/works/starrings/bulk/delete`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.deleteStarring(id)));
				return;
			}
			throw err;
		}
	}

	static async bulkPurgeStarrings(ids: number[]): Promise<void> {
		try {
			await api.post(`/api/works/starrings/bulk/purge`, { ids });
		} catch (err: unknown) {
			const e = err as { response?: { status?: number } };
			if (e?.response?.status === 404) {
				await Promise.all(ids.map((id) => this.purgeStarring(id)));
				return;
			}
			throw err;
		}
	}

	static async publishStarring(id: number): Promise<void> {
		await api.patch(`/api/works/starrings/${id}/publish`);
	}

	static async unpublishStarring(id: number): Promise<void> {
		await api.patch(`/api/works/starrings/${id}/unpublish`);
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

	// Trash methods for Directors
	static async getTrashedDirectors(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<Director>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<Director>>(`/api/works/directors/trash?${searchParams}`);
		return response.data;
	}

	static async restoreDirector(id: number): Promise<Director> {
		const response = await api.post<ApiResponse<Director>>(`/api/works/directors/${id}/restore`);
		return response.data.data;
	}

	static async purgeDirector(id: number): Promise<void> {
		await api.post(`/api/works/directors/${id}/purge`);
	}

	static async getDirectorsCounts(): Promise<WorksCounts> {
		const response = await api.get<ApiResponse<WorksCounts>>("/api/works/directors/counts");
		return response.data.data;
	}

	// Trash methods for Starrings
	static async getTrashedStarrings(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<Starring>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get<PaginatedResponse<Starring>>(`/api/works/starrings/trash?${searchParams}`);
		return response.data;
	}

	static async restoreStarring(id: number): Promise<Starring> {
		const response = await api.post<ApiResponse<Starring>>(`/api/works/starrings/${id}/restore`);
		return response.data.data;
	}

	static async purgeStarring(id: number): Promise<void> {
		await api.post(`/api/works/starrings/${id}/purge`);
	}

	static async getStarringsCounts(): Promise<WorksCounts> {
		const response = await api.get<ApiResponse<WorksCounts>>("/api/works/starrings/counts");
		return response.data.data;
	}

	static async revertToRevision(workId: number, revisionId: number): Promise<Work> {
		const response = await api.post<ApiResponse<Work>>(`/api/works/${workId}/revisions/${revisionId}/revert`);
		return response.data.data;
	}
}
