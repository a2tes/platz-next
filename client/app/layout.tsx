import type { Metadata } from "next";
import "./globals.css";
import ClientScripts from "@/components/ClientScripts";
import PageTransition from "@/components/PageTransition";
import { NavbarProvider } from "@/contexts/NavbarContext";
import { fetchPageSeo, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const seo = await fetchPageSeo("homepage");
	return {
		...buildPageMetadata(seo, "Platz Agency"),
		icons: {
			icon: [
				{ url: "/favicon/favicon.ico", sizes: "48x48" },
				{ url: "/favicon/favicon.svg", type: "image/svg+xml" },
				{ url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
			],
			apple: "/favicon/apple-touch-icon.png",
		},
		manifest: "/favicon/site.webmanifest",
	};
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="tr">
			<head>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" async></script>
				<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js" async></script>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body>
				<NavbarProvider>
					<ClientScripts />
					{/* {children} */}
					<PageTransition>{children}</PageTransition>
				</NavbarProvider>
			</body>
		</html>
	);
}
