import { prisma } from "../config/database";

export interface UpsertPageSeoData {
	title?: string | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	ogImageId?: number | null;
}

// Valid page keys for listing/index pages
export const VALID_PAGE_KEYS = ["homepage", "works"] as const;

export type PageKey = (typeof VALID_PAGE_KEYS)[number];

class PageSeoService {
	async getByPageKey(pageKey: string) {
		return prisma.pageSeo.findUnique({
			where: { pageKey },
		});
	}

	async getAll() {
		return prisma.pageSeo.findMany({
			orderBy: { pageKey: "asc" },
		});
	}

	async upsert(pageKey: string, data: UpsertPageSeoData) {
		return prisma.pageSeo.upsert({
			where: { pageKey },
			create: {
				pageKey,
				title: data.title ?? null,
				metaDescription: data.metaDescription ?? null,
				metaKeywords: data.metaKeywords ?? null,
				ogImageId: data.ogImageId ?? null,
			},
			update: {
				title: data.title ?? null,
				metaDescription: data.metaDescription ?? null,
				metaKeywords: data.metaKeywords ?? null,
				ogImageId: data.ogImageId ?? null,
			},
		});
	}
}

export const pageSeoService = new PageSeoService();
