import api from "@/lib/api";

export type TaxonomyTypeSlug = "clients" | "sectors" | "disciplines";

export interface Taxonomy {
	id: number;
	type: "CLIENT" | "SECTOR" | "DISCIPLINE";
	name: string;
	slug: string;
	status: "DRAFT" | "PUBLISHED";
	sortOrder: number;
	ogImageId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	metadata?: any;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string | null;
	creator?: { id: number; name: string } | null;
	ogImage?: any | null;
	_count?: {
		works: number;
	};
	// Added for BaseEntity compatibility (mapped from name)
	title?: string;
}

export interface CreateTaxonomyData {
	name: string;
	status?: "DRAFT" | "PUBLISHED";
	sortOrder?: number;
	ogImageId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	metadata?: any;
}

export interface UpdateTaxonomyData {
	name?: string;
	slug?: string;
	status?: "DRAFT" | "PUBLISHED";
	sortOrder?: number;
	ogImageId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	metadata?: any;
}

export interface TaxonomiesPaginatedResponse {
	taxonomies: Taxonomy[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface TaxonomyCounts {
	all: number;
	draft: number;
	published: number;
	trashed: number;
}

function buildTaxonomyService(typeSlug: TaxonomyTypeSlug) {
	const basePath = `/api/taxonomies/${typeSlug}`;

	return {
		async getAll(
			params: {
				page?: number;
				limit?: number;
				search?: string;
				sortBy?: "name" | "createdAt" | "updatedAt" | "sortOrder";
				sortOrder?: "asc" | "desc";
				status?: "DRAFT" | "PUBLISHED";
				mine?: boolean;
			} = {},
		): Promise<TaxonomiesPaginatedResponse> {
			const searchParams = new URLSearchParams();
			if (params.page) searchParams.append("page", params.page.toString());
			if (params.limit) searchParams.append("limit", params.limit.toString());
			if (params.search) searchParams.append("search", params.search);
			if (params.sortBy) searchParams.append("sortBy", params.sortBy);
			if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
			if (params.status) searchParams.append("status", params.status);
			if (params.mine) searchParams.append("mine", "true");

			const response = await api.get(`${basePath}?${searchParams.toString()}`);
			return response.data;
		},

		async getTrashed(
			params: {
				page?: number;
				limit?: number;
				search?: string;
			} = {},
		): Promise<TaxonomiesPaginatedResponse> {
			const searchParams = new URLSearchParams();
			if (params.page) searchParams.append("page", params.page.toString());
			if (params.limit) searchParams.append("limit", params.limit.toString());
			if (params.search) searchParams.append("search", params.search);

			const response = await api.get(`${basePath}/trash?${searchParams.toString()}`);
			return response.data;
		},

		async getCounts(): Promise<TaxonomyCounts> {
			const response = await api.get(`${basePath}/counts`);
			return response.data;
		},

		async search(query: string, limit: number = 10): Promise<Taxonomy[]> {
			const response = await api.get(`${basePath}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
			return response.data.data;
		},

		async getById(id: number): Promise<Taxonomy> {
			const response = await api.get(`${basePath}/${id}`);
			return response.data.data;
		},

		async create(data: CreateTaxonomyData): Promise<Taxonomy> {
			const response = await api.post(basePath, data);
			return response.data.data;
		},

		async findOrCreate(name: string): Promise<Taxonomy> {
			const response = await api.post(`${basePath}/find-or-create`, { name });
			return response.data.data;
		},

		async update(id: number, data: UpdateTaxonomyData): Promise<Taxonomy> {
			const response = await api.put(`${basePath}/${id}`, data);
			return response.data.data;
		},

		async delete(id: number): Promise<void> {
			await api.delete(`${basePath}/${id}`);
		},

		async restore(id: number): Promise<Taxonomy> {
			const response = await api.post(`${basePath}/${id}/restore`);
			return response.data.data;
		},

		async purge(id: number): Promise<void> {
			await api.post(`${basePath}/${id}/purge`);
		},

		async publish(id: number): Promise<Taxonomy> {
			const response = await api.post(`${basePath}/${id}/publish`);
			return response.data.data;
		},

		async unpublish(id: number): Promise<Taxonomy> {
			const response = await api.post(`${basePath}/${id}/unpublish`);
			return response.data.data;
		},

		async bulkDelete(ids: number[]): Promise<void> {
			await api.post(`${basePath}/bulk-delete`, { ids });
		},

		async bulkPurge(ids: number[]): Promise<void> {
			await api.post(`${basePath}/bulk-purge`, { ids });
		},

		async reorder(orderedIds: number[]): Promise<void> {
			await api.post(`${basePath}/reorder`, { orderedIds });
		},
	};
}

// Pre-built instances for each taxonomy type
export const taxonomyServices = {
	clients: buildTaxonomyService("clients"),
	sectors: buildTaxonomyService("sectors"),
	disciplines: buildTaxonomyService("disciplines"),
} as const;

// Helper to get service by type slug
export function getTaxonomyService(typeSlug: TaxonomyTypeSlug) {
	return taxonomyServices[typeSlug];
}

export default taxonomyServices;
