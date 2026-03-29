import api from "@/lib/api";

export interface Starring {
	id: number;
	name: string;
	slug: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateStarringData {
	name: string;
}

export interface UpdateStarringData {
	name?: string;
	slug?: string;
}

export const starringsService = {
	// Get all starrings
	async getStarrings(search?: string, limit?: number): Promise<Starring[]> {
		const params = new URLSearchParams();
		if (search) params.set("search", search);
		if (limit) params.set("limit", String(limit));

		const response = await api.get(`/api/starrings?${params.toString()}`);
		return response.data.data;
	},

	// Search starrings for autocomplete
	async searchStarrings(query: string, limit: number = 10): Promise<Starring[]> {
		const response = await api.get(`/api/starrings/search?q=${encodeURIComponent(query)}&limit=${limit}`);
		return response.data.data;
	},

	// Get a starring by ID
	async getStarring(id: number): Promise<Starring> {
		const response = await api.get(`/api/starrings/${id}`);
		return response.data.data;
	},

	// Create a new starring
	async createStarring(data: CreateStarringData): Promise<Starring> {
		const response = await api.post("/api/starrings", data);
		return response.data.data;
	},

	// Find or create a starring by name
	async findOrCreateStarring(name: string): Promise<Starring> {
		const response = await api.post("/api/starrings/find-or-create", { name });
		return response.data.data;
	},

	// Update a starring
	async updateStarring(id: number, data: UpdateStarringData): Promise<Starring> {
		const response = await api.put(`/api/starrings/${id}`, data);
		return response.data.data;
	},

	// Delete a starring
	async deleteStarring(id: number): Promise<void> {
		await api.delete(`/api/starrings/${id}`);
	},
};

export default starringsService;
