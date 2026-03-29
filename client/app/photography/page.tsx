import type { Metadata } from "next";
import { getApiUrl } from "@/lib/utils";
import { buildEntityMetadata } from "@/lib/seo";
import PhotographyContent from "./PhotographyContent";

type Props = {
	searchParams: Promise<{ p?: string; c?: string; g?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
	const { p: photographerSlug } = await searchParams;

	if (!photographerSlug) {
		// No photographer specified — let the layout's generateMetadata handle it
		return {};
	}

	try {
		const res = await fetch(
			`${getApiUrl()}/api/public/photography?photographer=${encodeURIComponent(photographerSlug)}`,
			{ next: { revalidate: 120 } },
		);
		if (!res.ok) return {};
		const data = await res.json();

		const photographer = data.photographer;
		if (!photographer) return {};

		return buildEntityMetadata(
			{
				title: photographer.title,
				metaDescription: photographer.metaDescription || null,
				metaKeywords: photographer.metaKeywords || null,
				ogImageUrl: photographer.ogImageUrl || null,
			},
			"Photography | Platz Agency",
		);
	} catch {
		return {};
	}
}

export default function PhotographyPage() {
	return <PhotographyContent />;
}
