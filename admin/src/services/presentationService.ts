import { api } from "@/lib/api";
import { EntityService, PaginatedResponse, CountsResponse } from "@/components/page/entity-list-page";

// ============================================
// TYPES
// ============================================

export interface Presentation {
	id: number;
	title: string;
	description?: string;
	clientName?: string;
	clientNote?: string;
	autoPlayEnabled?: boolean;
	photoSlideDuration?: number;
	token: string;
	validUntil?: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	_count?: {
		sections: number;
	};
	sections?: PresentationSection[];
	// BaseEntity compatibility
	status?: "PUBLISHED" | "DRAFT";
	slug?: string;
	publishedAt?: string | null;
	creator?: {
		name?: string;
	} | null;
}

export interface PresentationSection {
	id: number;
	presentationId: number;
	title: string;
	type: "PHOTOGRAPHY" | "MIXED";
	sortOrder: number;
	items: PresentationItem[];
}

export interface PresentationItem {
	id: number;
	sectionId: number;
	itemType: "WORK" | "PHOTOGRAPHY" | "EXTERNAL_LINK";
	workId?: number;
	photographyId?: number;
	externalThumbnailId?: number;
	externalUrl?: string;
	externalTitle?: string;
	externalDescription?: string;
	sortOrder: number;
	work?: {
		id: number;
		title: string;
		previewImage?: { url: string };
	};
	photography?: {
		id: number;
		title: string;
		image?: { url: string };
		photographer?: { id: number; title: string };
	};
	externalThumbnail?: { url: string; images?: Record<string, string> };
}

export interface PresentationWork {
	id: number;
	workId: number;
	sortOrder: number;
	work: {
		id: number;
		title: string;
		client?: string;
		previewImage?: {
			url: string;
		};
	};
}

export interface SectionInput {
	title: string;
	type: "PHOTOGRAPHY" | "MIXED";
	items: ItemInput[];
}

export interface ItemInput {
	itemType: "WORK" | "PHOTOGRAPHY" | "EXTERNAL_LINK";
	workId?: number;
	photographyId?: number;
	externalUrl?: string;
	externalTitle?: string;
	externalDescription?: string;
	externalThumbnailId?: number;
}

export interface CreatePresentationDto {
	title: string;
	description?: string;
	clientName?: string;
	clientNote?: string;
	autoPlayEnabled?: boolean;
	photoSlideDuration?: number;
	validUntil?: string | null;
	isActive?: boolean;
	sections?: SectionInput[];
}

export interface UpdatePresentationDto extends Partial<CreatePresentationDto> {}

// ============================================
// OPTION TYPES (for adding items to sections)
// ============================================

export interface PhotographyOption {
	id: number;
	title: string;
	image?: { url: string };
	photographer?: { id: number; title: string };
	clients?: { client: { id: number; title: string } }[];
	categories?: { category: { id: number; title: string } }[];
}

export const PresentationService = {
	getPresentations: async (
		params: {
			page?: number;
			limit?: number;
			search?: string;
			status?: "DRAFT" | "PUBLISHED" | "ALL" | "TRASH";
			sortBy?: string;
			sortOrder?: "asc" | "desc";
			mine?: boolean;
		} = {},
	) => {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.status) searchParams.append("status", params.status);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.mine) searchParams.append("mine", String(params.mine));

		const response = await api.get<PaginatedResponse<Presentation>>(`/api/presentations?${searchParams}`);

		// Map backend fields to frontend expected format
		return {
			...response.data,
			data: response.data.data.map((item) => ({
				...item,
				status: item.isActive ? "PUBLISHED" : "DRAFT",
				slug: item.token,
			})),
		};
	},

	getById: async (id: number) => {
		const response = await api.get<Presentation>(`/api/presentations/${id}`);
		return response.data;
	},

	create: async (data: CreatePresentationDto) => {
		const response = await api.post<Presentation>("/api/presentations", data);
		return response.data;
	},

	update: async (id: number, data: UpdatePresentationDto) => {
		const response = await api.put<Presentation>(`/api/presentations/${id}`, data);
		return response.data;
	},

	delete: async (id: number) => {
		await api.delete(`/api/presentations/${id}`);
	},

	// EntityService implementation
	getItems: async (params: any) => {
		return PresentationService.getPresentations(params);
	},

	getTrashedItems: async (params: any) => {
		return PresentationService.getPresentations({
			...params,
			status: "TRASH",
		});
	},

	getCounts: async (): Promise<CountsResponse> => {
		const response = await api.get<CountsResponse>("/api/presentations/counts");
		return response.data;
	},

	deleteItem: async (id: number) => {
		return PresentationService.delete(id);
	},

	purgeItem: async (id: number) => {
		await api.delete(`/api/presentations/${id}/purge`);
	},

	restoreItem: async (id: number) => {
		await api.patch(`/api/presentations/${id}/restore`);
	},

	updateItem: async (id: number, data: any) => {
		return PresentationService.update(id, data);
	},

	publishItem: async (id: number) => {
		return PresentationService.update(id, { isActive: true });
	},

	unpublishItem: async (id: number) => {
		return PresentationService.update(id, { isActive: false });
	},

	bulkDeleteItems: async (ids: number[]) => {
		await Promise.all(ids.map((id) => PresentationService.delete(id)));
	},

	bulkPurgeItems: async (ids: number[]) => {
		await Promise.all(ids.map((id) => PresentationService.delete(id)));
	},

	bulkPublish: async (ids: number[]) => {
		await Promise.all(ids.map((id) => PresentationService.update(id, { isActive: true })));
	},

	bulkUnpublish: async (ids: number[]) => {
		await Promise.all(ids.map((id) => PresentationService.update(id, { isActive: false })));
	},

	// Photography options for presentation builder
	getPhotographyOptions: async (
		params: {
			photographerId?: number;
			categoryId?: number;
			clientId?: number;
			search?: string;
		} = {},
	) => {
		const searchParams = new URLSearchParams();
		if (params.photographerId) searchParams.append("photographerId", params.photographerId.toString());
		if (params.categoryId) searchParams.append("categoryId", params.categoryId.toString());
		if (params.clientId) searchParams.append("clientId", params.clientId.toString());
		if (params.search) searchParams.append("search", params.search);
		const response = await api.get<PhotographyOption[]>(`/api/presentations/photography-options?${searchParams}`);
		return response.data;
	},
};
