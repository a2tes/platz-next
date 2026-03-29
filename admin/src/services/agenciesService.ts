import api from "@/lib/api";

export interface Agency {
	id: number;
	name: string;
	slug: string;
	status: "DRAFT" | "PUBLISHED";
	createdAt: string;
	updatedAt: string;
	deletedAt?: string | null;
	creator?: { id: number; name: string } | null;
	_count?: {
		works: number;
		photography: number;
		animations: number;
	};
	// Added for BaseEntity compatibility (mapped from name)
	title?: string;
}

export interface CreateAgencyData {
	name: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdateAgencyData {
	name?: string;
	slug?: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface PaginatedResponse<T> {
	agencies: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface AgenciesCounts {
	all: number;
	draft: number;
	published: number;
	trashed: number;
}

export const agenciesService = {
	// Get paginated agencies
	async getAgencies(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "name" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Agency>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", "true");

		const response = await api.get(`/api/agencies?${searchParams.toString()}`);
		return response.data;
	},

	// Get trashed agencies
	async getTrashedAgencies(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<Agency>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get(`/api/agencies/trash?${searchParams.toString()}`);
		return response.data;
	},

	// Get counts
	async getCounts(): Promise<AgenciesCounts> {
		const response = await api.get("/api/agencies/counts");
		return response.data;
	},

	// Search agencies for autocomplete
	async searchAgencies(query: string, limit: number = 10): Promise<Agency[]> {
		const response = await api.get(`/api/agencies/search?q=${encodeURIComponent(query)}&limit=${limit}`);
		return response.data.data;
	},

	// Get an agency by ID
	async getAgency(id: number): Promise<Agency> {
		const response = await api.get(`/api/agencies/${id}`);
		return response.data.data;
	},

	// Create a new agency
	async createAgency(data: CreateAgencyData): Promise<Agency> {
		const response = await api.post("/api/agencies", data);
		return response.data.data;
	},

	// Find or create an agency by name
	async findOrCreateAgency(name: string): Promise<Agency> {
		const response = await api.post("/api/agencies/find-or-create", { name });
		return response.data.data;
	},

	// Update an agency
	async updateAgency(id: number, data: UpdateAgencyData): Promise<Agency> {
		const response = await api.put(`/api/agencies/${id}`, data);
		return response.data.data;
	},

	// Soft delete an agency
	async deleteAgency(id: number): Promise<void> {
		await api.delete(`/api/agencies/${id}`);
	},

	// Restore a trashed agency
	async restoreAgency(id: number): Promise<Agency> {
		const response = await api.post(`/api/agencies/${id}/restore`);
		return response.data.data;
	},

	// Permanently delete an agency
	async purgeAgency(id: number): Promise<void> {
		await api.post(`/api/agencies/${id}/purge`);
	},

	// Publish an agency
	async publishAgency(id: number): Promise<Agency> {
		const response = await api.post(`/api/agencies/${id}/publish`);
		return response.data.data;
	},

	// Unpublish an agency
	async unpublishAgency(id: number): Promise<Agency> {
		const response = await api.post(`/api/agencies/${id}/unpublish`);
		return response.data.data;
	},

	// Bulk delete agencies
	async bulkDeleteAgencies(ids: number[]): Promise<void> {
		await api.post("/api/agencies/bulk-delete", { ids });
	},

	// Bulk purge agencies
	async bulkPurgeAgencies(ids: number[]): Promise<void> {
		await api.post("/api/agencies/bulk-purge", { ids });
	},

	// Legacy method for backward compatibility
	async getAll(): Promise<Agency[]> {
		const response = await api.get("/api/agencies?limit=1000");
		return response.data.agencies || [];
	},

	// Legacy method alias
	async getAgencies_legacy(search?: string, limit?: number): Promise<Agency[]> {
		const params = new URLSearchParams();
		if (search) params.set("search", search);
		if (limit) params.set("limit", String(limit));
		const response = await api.get(`/api/agencies?${params.toString()}`);
		return response.data.agencies || [];
	},
};

export default agenciesService;
