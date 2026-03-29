import type { Metadata } from "next";
import { fetchEntityBySlug, buildEntityMetadata } from "@/lib/seo";

type Props = {
	params: Promise<{ slug: string; workSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug, workSlug } = await params;
	// Fetch the work directly for SEO metadata
	const work = await fetchEntityBySlug("works", workSlug);
	if (work) {
		return buildEntityMetadata(work, "Work | Platz Agency");
	}
	// Fallback: use director name
	const director = await fetchEntityBySlug("directors", slug);
	return buildEntityMetadata(director, "Work | Platz Agency");
}

export default function DirectorWorkDetailLayout({ children }: { children: React.ReactNode }) {
	return children;
}
