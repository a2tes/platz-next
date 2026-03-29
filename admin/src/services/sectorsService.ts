import api from "@/lib/api";

export interface Sector {
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
	};
	// Added for BaseEntity compatibility (mapped from name)
	title?: string;
}

export interface CreateSectorData {
	name: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdateSectorData {
	name?: string;
	slug?: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface PaginatedResponse<T> {
	sectors: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface SectorsCounts {
	all: number;
	draft: number;
	published: number;
	trashed: number;
}

export const sectorsService = {
	// Get paginated sectors
	async getSectors(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "name" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Sector>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", "true");

		const response = await api.get(`/api/sectors?${searchParams.toString()}`);
		return response.data;
	},

	// Get trashed sectors
	async getTrashedSectors(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<Sector>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get(`/api/sectors/trash?${searchParams.toString()}`);
		return response.data;
	},

	// Get counts
	async getCounts(): Promise<SectorsCounts> {
		const response = await api.get("/api/sectors/counts");
		return response.data;
	},

	// Search sectors for autocomplete
	async searchSectors(query: string, limit: number = 10): Promise<Sector[]> {
		const response = await api.get(`/api/sectors/search?q=${encodeURIComponent(query)}&limit=${limit}`);
		return response.data.data;
	},

	// Get a sector by ID
	async getSector(id: number): Promise<Sector> {
		const response = await api.get(`/api/sectors/${id}`);
		return response.data.data;
	},

	// Create a new sector
	async createSector(data: CreateSectorData): Promise<Sector> {
		const response = await api.post("/api/sectors", data);
		return response.data.data;
	},

	// Find or create a sector by name
	async findOrCreateSector(name: string): Promise<Sector> {
		const response = await api.post("/api/sectors/find-or-create", { name });
		return response.data.data;
	},

	// Update a sector
	async updateSector(id: number, data: UpdateSectorData): Promise<Sector> {
		const response = await api.put(`/api/sectors/${id}`, data);
		return response.data.data;
	},

	// Soft delete a sector
	async deleteSector(id: number): Promise<void> {
		await api.delete(`/api/sectors/${id}`);
	},

	// Restore a trashed sector
	async restoreSector(id: number): Promise<Sector> {
		const response = await api.post(`/api/sectors/${id}/restore`);
		return response.data.data;
	},

	// Permanently delete a sector
	async purgeSector(id: number): Promise<void> {
		await api.post(`/api/sectors/${id}/purge`);
	},

	// Publish a sector
	async publishSector(id: number): Promise<Sector> {
		const response = await api.post(`/api/sectors/${id}/publish`);
		return response.data.data;
	},

	// Unpublish a sector
	async unpublishSector(id: number): Promise<Sector> {
		const response = await api.post(`/api/sectors/${id}/unpublish`);
		return response.data.data;
	},

	// Bulk delete sectors
	async bulkDeleteSectors(ids: number[]): Promise<void> {
		await api.post("/api/sectors/bulk-delete", { ids });
	},

	// Bulk purge sectors
	async bulkPurgeSectors(ids: number[]): Promise<void> {
		await api.post("/api/sectors/bulk-purge", { ids });
	},

	// Legacy method for backward compatibility
	async getAll(): Promise<Sector[]> {
		const response = await api.get("/api/sectors?limit=1000");
		return response.data.sectors || [];
	},
};

export default sectorsService;
