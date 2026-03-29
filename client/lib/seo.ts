import type { Metadata } from "next";
import { getApiUrl } from "./utils";

export interface PageSeoData {
	pageKey: string;
	title?: string | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	ogImageUrl?: string | null;
}

export interface EntitySeoData {
	title?: string;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	ogImageUrl?: string | null;
}

const SITE_NAME = "Platz Agency";
const DEFAULT_OG_IMAGE =
	"https://skokapp.imgix.net/22506038-a7d2-4994-aca7-d97f167496a3/skok-white.jpg?rect=128%2C89%2C945%2C496&w=1280&h=672&q=82&auto=format%2Ccompress&fm=webp";

/**
 * Fetch PageSeo data from the public API (server-side).
 */
export async function fetchPageSeo(pageKey: string): Promise<PageSeoData | null> {
	try {
		const res = await fetch(`${getApiUrl()}/api/public/page-seo/${pageKey}`, {
			next: { revalidate: 600 },
		});
		if (!res.ok) return null;
		const json = await res.json();
		return json.success ? json.data : null;
	} catch {
		return null;
	}
}

/**
 * Fetch entity data by slug from a public endpoint (server-side).
 */
export async function fetchEntityBySlug(endpoint: string, slug: string): Promise<EntitySeoData | null> {
	try {
		const res = await fetch(`${getApiUrl()}/api/public/${endpoint}/${slug}`, {
			next: { revalidate: 120 },
		});
		if (!res.ok) return null;
		const json = await res.json();
		// Some endpoints wrap in { success, data }, others return directly
		if (json.success !== undefined) {
			return json.data || null;
		}
		return json || null;
	} catch {
		return null;
	}
}

/**
 * Build Metadata object for a listing page using PageSeo data.
 */
export function buildPageMetadata(seo: PageSeoData | null, fallbackTitle: string): Metadata {
	const title = seo?.title || fallbackTitle;
	const description = seo?.metaDescription || undefined;
	return {
		title,
		description,
		keywords: seo?.metaKeywords || undefined,
		openGraph: {
			title,
			description,
			siteName: SITE_NAME,
			images: [{ url: seo?.ogImageUrl || DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
		},
	};
}

/**
 * Build Metadata object for an entity detail page.
 */
export function buildEntityMetadata(entity: EntitySeoData | null, fallbackTitle: string): Metadata {
	const title = entity?.title ? `${entity.title} | ${SITE_NAME}` : fallbackTitle;
	return {
		title,
		description: entity?.metaDescription || undefined,
		keywords: entity?.metaKeywords || undefined,
		openGraph: {
			title,
			description: entity?.metaDescription || undefined,
			siteName: SITE_NAME,
			images: [{ url: entity?.ogImageUrl || DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
		},
	};
}
