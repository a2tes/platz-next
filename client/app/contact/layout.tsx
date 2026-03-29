import type { Metadata } from "next";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("contact");
	return buildPageMetadata(seo, "Contact | Platz Agency");
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
	return children;
}
