import { api } from "../lib/api";
import type { QuillEditorData } from "@/components/content/QuillEditor";
import { MediaFile } from "./mediaService";

export type PageStatus = "DRAFT" | "PUBLISHED" | "UNLISTED";

export interface ContentPage {
	id: number;
	type: "ABOUT" | "CONTACT" | "LEGAL";
	slug?: string;
	title: string;
	contentBlocks?: QuillEditorData | null; // Raw Quill blocks
	mapEmbed?: string | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	previewImage?: MediaFile | null;
	status: PageStatus;
	creator?: { id: number; name: string; email: string } | null;
	createdAt: string;
	updatedAt: string;
	publishedAt?: string | null;
}

export interface UpdateAboutPayload {
	title?: string;
	contentBlocks?: QuillEditorData;
	mapEmbed?: string | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	previewImageId?: number | null;
	status?: PageStatus;
}

export class ContentService {
	static async getAbout(): Promise<ContentPage> {
		const res = await api.get<{ success: boolean; data: ContentPage }>("/api/content/about");
		return res.data.data;
	}

	static async updateAbout(payload: UpdateAboutPayload): Promise<ContentPage> {
		const res = await api.put<{ success: boolean; data: ContentPage }>("/api/content/about", payload);
		return res.data.data;
	}

	// Contact page
	static async getContact(): Promise<ContentPage> {
		const res = await api.get<{ success: boolean; data: ContentPage }>("/api/content/contact");
		return res.data.data;
	}

	static async updateContact(payload: UpdateAboutPayload): Promise<ContentPage> {
		const res = await api.put<{ success: boolean; data: ContentPage }>("/api/content/contact", payload);
		return res.data.data;
	}

	// Legal pages
	static async getLegalPaginated(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			status?: PageStatus;
			mine?: boolean;
		} = {},
	) {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", String(params.page));
		if (params.limit) searchParams.append("limit", String(params.limit));
		if (params.search) searchParams.append("search", params.search);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", String(params.mine));

		const res = await api.get<{
			success: boolean;
			data: {
				data: ContentPage[];
				meta: {
					pagination: {
						page: number;
						limit: number;
						totalItems: number;
						totalPages: number;
					};
				};
			};
		}>(`/api/content/legal?${searchParams}`);
		return res.data.data;
	}

	static async getTrashedLegal(params: { page?: number; limit?: number; search?: string } = {}) {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", String(params.page));
		if (params.limit) searchParams.append("limit", String(params.limit));
		if (params.search) searchParams.append("search", params.search);
		const res = await api.get<{
			success: boolean;
			data: {
				data: ContentPage[];
				meta: {
					pagination: {
						page: number;
						limit: number;
						totalItems: number;
						totalPages: number;
					};
				};
			};
		}>(`/api/content/legal/trashed?${searchParams}`);
		return res.data.data;
	}

	static async getLegalCounts(): Promise<{
		all: number;
		mine: number;
		published: number;
		draft: number;
		trash: number;
	}> {
		const res = await api.get<{
			success: boolean;
			data: {
				all: number;
				mine: number;
				published: number;
				draft: number;
				trash: number;
			};
		}>("/api/content/legal/counts");
		return res.data.data;
	}

	static async createLegal(payload: UpdateAboutPayload): Promise<ContentPage> {
		const res = await api.post<{ success: boolean; data: ContentPage }>("/api/content/legal", payload);
		return res.data.data;
	}

	static async getLegalById(id: number): Promise<ContentPage> {
		const res = await api.get<{ success: boolean; data: ContentPage }>(`/api/content/legal/${id}`);
		return res.data.data;
	}

	static async updateLegalById(id: number, payload: UpdateAboutPayload): Promise<ContentPage> {
		const res = await api.put<{ success: boolean; data: ContentPage }>(`/api/content/legal/${id}`, payload);
		return res.data.data;
	}

	static async deleteLegalById(id: number): Promise<void> {
		await api.delete(`/api/content/legal/${id}`);
	}

	static async restoreLegalById(id: number): Promise<void> {
		await api.patch(`/api/content/legal/${id}/restore`);
	}

	static async purgeLegalById(id: number): Promise<void> {
		await api.delete(`/api/content/legal/${id}/purge`);
	}

	static async publishLegalById(id: number): Promise<ContentPage> {
		const res = await api.patch<{ success: boolean; data: ContentPage }>(`/api/content/legal/${id}/publish`);
		return res.data.data;
	}

	static async unpublishLegalById(id: number): Promise<ContentPage> {
		const res = await api.patch<{ success: boolean; data: ContentPage }>(`/api/content/legal/${id}/unpublish`);
		return res.data.data;
	}

	static async bulkPublishLegal(ids: number[]): Promise<void> {
		await api.post("/api/content/legal/bulk/publish", { ids });
	}

	static async bulkUnpublishLegal(ids: number[]): Promise<void> {
		await api.post("/api/content/legal/bulk/unpublish", { ids });
	}

	static async bulkDeleteLegal(ids: number[]): Promise<void> {
		await api.post("/api/content/legal/bulk/delete", { ids });
	}

	static async bulkRestoreLegal(ids: number[]): Promise<void> {
		await api.post("/api/content/legal/bulk/restore", { ids });
	}

	static async bulkPurgeLegal(ids: number[]): Promise<void> {
		await api.post("/api/content/legal/bulk/purge", { ids });
	}
}
