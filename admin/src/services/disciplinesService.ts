import api from "@/lib/api";

export interface Discipline {
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

export interface CreateDisciplineData {
	name: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdateDisciplineData {
	name?: string;
	slug?: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface PaginatedResponse<T> {
	disciplines: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface DisciplinesCounts {
	all: number;
	draft: number;
	published: number;
	trashed: number;
}

export const disciplinesService = {
	// Get paginated disciplines
	async getDisciplines(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "name" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Discipline>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", "true");

		const response = await api.get(`/api/disciplines?${searchParams.toString()}`);
		return response.data;
	},

	// Get trashed disciplines
	async getTrashedDisciplines(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<Discipline>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get(`/api/disciplines/trash?${searchParams.toString()}`);
		return response.data;
	},

	// Get counts
	async getCounts(): Promise<DisciplinesCounts> {
		const response = await api.get("/api/disciplines/counts");
		return response.data;
	},

	// Search disciplines for autocomplete
	async searchDisciplines(query: string, limit: number = 10): Promise<Discipline[]> {
		const response = await api.get(`/api/disciplines/search?q=${encodeURIComponent(query)}&limit=${limit}`);
		return response.data.data;
	},

	// Get a discipline by ID
	async getDiscipline(id: number): Promise<Discipline> {
		const response = await api.get(`/api/disciplines/${id}`);
		return response.data.data;
	},

	// Create a new discipline
	async createDiscipline(data: CreateDisciplineData): Promise<Discipline> {
		const response = await api.post("/api/disciplines", data);
		return response.data.data;
	},

	// Find or create a discipline by name
	async findOrCreateDiscipline(name: string): Promise<Discipline> {
		const response = await api.post("/api/disciplines/find-or-create", { name });
		return response.data.data;
	},

	// Update a discipline
	async updateDiscipline(id: number, data: UpdateDisciplineData): Promise<Discipline> {
		const response = await api.put(`/api/disciplines/${id}`, data);
		return response.data.data;
	},

	// Soft delete a discipline
	async deleteDiscipline(id: number): Promise<void> {
		await api.delete(`/api/disciplines/${id}`);
	},

	// Restore a trashed discipline
	async restoreDiscipline(id: number): Promise<Discipline> {
		const response = await api.post(`/api/disciplines/${id}/restore`);
		return response.data.data;
	},

	// Permanently delete a discipline
	async purgeDiscipline(id: number): Promise<void> {
		await api.post(`/api/disciplines/${id}/purge`);
	},

	// Publish a discipline
	async publishDiscipline(id: number): Promise<Discipline> {
		const response = await api.post(`/api/disciplines/${id}/publish`);
		return response.data.data;
	},

	// Unpublish a discipline
	async unpublishDiscipline(id: number): Promise<Discipline> {
		const response = await api.post(`/api/disciplines/${id}/unpublish`);
		return response.data.data;
	},

	// Bulk delete disciplines
	async bulkDeleteDisciplines(ids: number[]): Promise<void> {
		await api.post("/api/disciplines/bulk-delete", { ids });
	},

	// Bulk purge disciplines
	async bulkPurgeDisciplines(ids: number[]): Promise<void> {
		await api.post("/api/disciplines/bulk-purge", { ids });
	},

	// Legacy method for backward compatibility
	async getAll(): Promise<Discipline[]> {
		const response = await api.get("/api/disciplines?limit=1000");
		return response.data.disciplines || [];
	},
};

export default disciplinesService;
