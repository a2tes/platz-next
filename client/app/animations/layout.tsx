import type { Metadata } from "next";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("animations");
	return buildPageMetadata(seo, "Animations | Platz Agency");
}

export default function AnimationsLayout({ children }: { children: React.ReactNode }) {
	return children;
}
