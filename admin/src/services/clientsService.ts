import api from "@/lib/api";

export interface Client {
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

export interface CreateClientData {
	name: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface UpdateClientData {
	name?: string;
	slug?: string;
	status?: "DRAFT" | "PUBLISHED";
}

export interface PaginatedResponse<T> {
	clients: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface ClientsCounts {
	all: number;
	draft: number;
	published: number;
	trashed: number;
}

export const clientsService = {
	// Get paginated clients
	async getClients(
		params: {
			page?: number;
			limit?: number;
			search?: string;
			sortBy?: "name" | "createdAt" | "updatedAt";
			sortOrder?: "asc" | "desc";
			status?: "DRAFT" | "PUBLISHED";
			mine?: boolean;
		} = {},
	): Promise<PaginatedResponse<Client>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.sortBy) searchParams.append("sortBy", params.sortBy);
		if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
		if (params.status) searchParams.append("status", params.status);
		if (params.mine) searchParams.append("mine", "true");

		const response = await api.get(`/api/clients?${searchParams.toString()}`);
		return response.data;
	},

	// Get trashed clients
	async getTrashedClients(
		params: {
			page?: number;
			limit?: number;
			search?: string;
		} = {},
	): Promise<PaginatedResponse<Client>> {
		const searchParams = new URLSearchParams();
		if (params.page) searchParams.append("page", params.page.toString());
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.search) searchParams.append("search", params.search);

		const response = await api.get(`/api/clients/trash?${searchParams.toString()}`);
		return response.data;
	},

	// Get counts
	async getCounts(): Promise<ClientsCounts> {
		const response = await api.get("/api/clients/counts");
		return response.data;
	},

	// Search clients for autocomplete
	async searchClients(query: string, limit: number = 10): Promise<Client[]> {
		const response = await api.get(`/api/clients/search?q=${encodeURIComponent(query)}&limit=${limit}`);
		return response.data.data;
	},

	// Get a client by ID
	async getClient(id: number): Promise<Client> {
		const response = await api.get(`/api/clients/${id}`);
		return response.data.data;
	},

	// Create a new client
	async createClient(data: CreateClientData): Promise<Client> {
		const response = await api.post("/api/clients", data);
		return response.data.data;
	},

	// Find or create a client by name
	async findOrCreateClient(name: string): Promise<Client> {
		const response = await api.post("/api/clients/find-or-create", { name });
		return response.data.data;
	},

	// Update a client
	async updateClient(id: number, data: UpdateClientData): Promise<Client> {
		const response = await api.put(`/api/clients/${id}`, data);
		return response.data.data;
	},

	// Soft delete a client
	async deleteClient(id: number): Promise<void> {
		await api.delete(`/api/clients/${id}`);
	},

	// Restore a trashed client
	async restoreClient(id: number): Promise<Client> {
		const response = await api.post(`/api/clients/${id}/restore`);
		return response.data.data;
	},

	// Permanently delete a client
	async purgeClient(id: number): Promise<void> {
		await api.post(`/api/clients/${id}/purge`);
	},

	// Publish a client
	async publishClient(id: number): Promise<Client> {
		const response = await api.post(`/api/clients/${id}/publish`);
		return response.data.data;
	},

	// Unpublish a client
	async unpublishClient(id: number): Promise<Client> {
		const response = await api.post(`/api/clients/${id}/unpublish`);
		return response.data.data;
	},

	// Bulk delete clients
	async bulkDeleteClients(ids: number[]): Promise<void> {
		await api.post("/api/clients/bulk-delete", { ids });
	},

	// Bulk purge clients
	async bulkPurgeClients(ids: number[]): Promise<void> {
		await api.post("/api/clients/bulk-purge", { ids });
	},

	// Legacy method for backward compatibility
	async getAll(): Promise<Client[]> {
		const response = await api.get("/api/clients?limit=1000");
		return response.data.clients || [];
	},

	// Legacy method alias
	async getClients_legacy(search?: string, limit?: number): Promise<Client[]> {
		const params = new URLSearchParams();
		if (search) params.set("search", search);
		if (limit) params.set("limit", String(limit));
		const response = await api.get(`/api/clients?${params.toString()}`);
		return response.data.clients || [];
	},
};

export default clientsService;
