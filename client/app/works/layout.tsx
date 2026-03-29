import type { Metadata } from "next";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("works");
	return buildPageMetadata(seo, "Works | Platz Agency");
}

export default function WorksLayout({ children }: { children: React.ReactNode }) {
	return children;
}
