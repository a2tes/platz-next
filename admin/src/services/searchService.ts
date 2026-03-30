import { api } from "../lib/api";

export interface SearchResult {
	id: number;
	title: string;
	description?: string;
	module: "works" | "photography" | "content";
	type: string;
	url: string;
	createdAt: string;
	updatedAt: string;
}

export interface SearchResponse {
	success: boolean;
	data: SearchResult[];
	meta: {
		total: number;
		query: string;
		modules: string[];
	};
}

export class SearchService {
	static async globalSearch(query: string, modules?: string[]): Promise<SearchResponse> {
		const params = new URLSearchParams({
			q: query,
		});

		if (modules && modules.length > 0) {
			params.append("modules", modules.join(","));
		}

		const response = await api.get(`/search/global?${params.toString()}`);
		return response.data;
	}

	static async searchWorks(query: string): Promise<SearchResponse> {
		const response = await api.get(`/search/works?q=${encodeURIComponent(query)}`);
		return response.data;
	}

	static async searchPhotography(query: string): Promise<SearchResponse> {
		const response = await api.get(`/search/photography?q=${encodeURIComponent(query)}`);
		return response.data;
	}

	static async searchContent(query: string): Promise<SearchResponse> {
		const response = await api.get(`/search/content?q=${encodeURIComponent(query)}`);
		return response.data;
	}

	static async getSearchSuggestions(query: string): Promise<string[]> {
		if (query.length < 2) return [];

		const response = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}`);
		return response.data.data || [];
	}
}
