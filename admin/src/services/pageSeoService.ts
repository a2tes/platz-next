import { api } from "../lib/api";

export interface PageSeoData {
	id?: number;
	pageKey: string;
	title?: string | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	ogImageId?: number | null;
}

export class PageSeoService {
	static async getByPageKey(pageKey: string): Promise<PageSeoData | null> {
		const res = await api.get<{ success: boolean; data: PageSeoData | null }>(`/api/page-seo/${pageKey}`);
		return res.data.data;
	}

	static async upsert(pageKey: string, data: Omit<PageSeoData, "id" | "pageKey">): Promise<PageSeoData> {
		const res = await api.put<{ success: boolean; data: PageSeoData }>(`/api/page-seo/${pageKey}`, data);
		return res.data.data;
	}
}
