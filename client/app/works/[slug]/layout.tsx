import type { Metadata } from "next";
import { fetchEntityBySlug, buildEntityMetadata } from "@/lib/seo";

type Props = {
	params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const work = await fetchEntityBySlug("works", slug);
	return buildEntityMetadata(work, "Work | Platz Agency");
}

export default function WorkDetailLayout({ children }: { children: React.ReactNode }) {
	return children;
}
