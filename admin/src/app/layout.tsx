import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { Providers } from "../components/providers/Providers";
import { UploadProgressPanel } from "../components/media/UploadProgressPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Platz Admin Panel",
	description: "Content Management System Admin Panel",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<Providers>
					<AuthProvider>
						<ScrollArea className="h-screen">
							{children}
							<UploadProgressPanel />
						</ScrollArea>
					</AuthProvider>
				</Providers>
			</body>
		</html>
	);
}
