import type { Metadata } from "next";
import { fetchEntityBySlug, buildEntityMetadata } from "@/lib/seo";

type Props = {
	params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const director = await fetchEntityBySlug("directors", slug);
	return buildEntityMetadata(director, "Director | Platz Agency");
}

export default function DirectorDetailLayout({ children }: { children: React.ReactNode }) {
	return children;
}
