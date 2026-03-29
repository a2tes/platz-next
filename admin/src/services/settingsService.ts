import { api } from "../lib/api";

export interface SiteSettings {
	siteName?: string;
	siteTagline?: string;
	siteDescription?: string;
	copyrightText?: string;
	googleAnalyticsId?: string;
	socialMedia?: {
		instagram?: string;
		vimeo?: string;
		youtube?: string;
		linkedin?: string;
		x?: string;
		facebook?: string;
		tiktok?: string;
	};
	contactEmail?: string;
	contactPhone?: string;
	contactAddress?: string;
	contactMapEmbed?: string;
	[key: string]: any;
}

export class SettingsService {
	/**
	 * Get all site settings
	 */
	static async getAll(): Promise<SiteSettings> {
		const response = await api.get<{ success: boolean; data: SiteSettings }>("/api/settings");
		return response.data.data;
	}

	/**
	 * Update multiple settings
	 */
	static async update(settings: SiteSettings): Promise<SiteSettings> {
		const response = await api.put<{ success: boolean; data: SiteSettings }>("/api/settings", settings);
		return response.data.data;
	}
}
