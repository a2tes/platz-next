import type { Metadata } from "next";
import { fetchEntityBySlug, buildEntityMetadata } from "@/lib/seo";

type Props = {
	params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const animation = await fetchEntityBySlug("animations", slug);
	return buildEntityMetadata(animation, "Animation | Platz Agency");
}

export default function AnimationDetailLayout({ children }: { children: React.ReactNode }) {
	return children;
}
