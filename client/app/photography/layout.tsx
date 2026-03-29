import type { Metadata } from "next";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("photography");
	return buildPageMetadata(seo, "Photography | Platz Agency");
}

export default function PhotographyLayout({ children }: { children: React.ReactNode }) {
	return children;
}
