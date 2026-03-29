import type { Metadata } from "next";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("directors");
	return buildPageMetadata(seo, "Directors | Platz Agency");
}

export default function DirectorsLayout({ children }: { children: React.ReactNode }) {
	return children;
}
