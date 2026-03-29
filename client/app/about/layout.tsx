import type { Metadata } from "next";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("about");
	return buildPageMetadata(seo, "About | Platz Agency");
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
	return children;
}
