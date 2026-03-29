"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "../../components/auth/LoginForm";
import { useAuth, useAuthStore } from "../../stores/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { TextFlip } from "@/components/ui/TextFlip";

const bgImages = [
	"/nature/antalya-waterfalls.jpg",
	"/nature/ayder-plateau.jpg",
	"/nature/belgrad-forest.jpg",
	"/nature/butterfly-valley.jpg",
	"/nature/cappadocia-1.jpg",
	"/nature/oludeniz.jpg",
	"/nature/pamukkale-turkey.jpg",
	"/nature/patara-beach.jpg",
	"/nature/saklikent-canyon.jpg",
	"/nature/van-gurpinar.jpg",
	"/nature/van-akdamar.jpg",
];

export default function LoginPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	// Choose background image sequentially across page opens
	const [bgUrl, setBgUrl] = useState<string>(bgImages[0]);

	useEffect(() => {
		// Rotate through images using localStorage index
		const key = "loginBgIndex";
		try {
			const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
			let idx = raw ? parseInt(raw, 10) : 0;
			if (Number.isNaN(idx) || idx < 0) idx = 0;
			// Clamp and set current URL
			const safeIdx = bgImages.length > 0 ? idx % bgImages.length : 0;
			setBgUrl(bgImages[safeIdx]);
			// Store next index for subsequent opens
			const nextIdx = bgImages.length > 0 ? (safeIdx + 1) % bgImages.length : 0;
			localStorage.setItem(key, String(nextIdx));
		} catch {
			// Fallback keeps default bgUrl
		}
	}, []);

	// Initialize auth on mount
	useEffect(() => {
		useAuthStore.getState().initializeAuth?.();
	}, []);

	// Redirect if already authenticated
	useEffect(() => {
		if (!isLoading && isAuthenticated) {
			router.push("/dashboard");
		}
	}, [isAuthenticated, isLoading, router]);

	// Show loading while checking auth state
	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
			</div>
		);
	}

	// Don't render login form if already authenticated
	if (isAuthenticated) {
		return null;
	}

	return (
		<div className="min-h-screen grid lg:grid-cols-2 bg-background">
			{/* Left side - branding / artwork */}
			<div className="relative hidden lg:flex flex-col justify-between p-10 border-r bg-black">
				{/* Overlay */}
				<div
					className="absolute inset-0 opacity-40"
					style={{
						backgroundImage: `url(${bgUrl})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
					}}
				></div>
				<div className="flex items-center gap-1 font-bold text-sm">
					<div className="p-1 rounded flex items-center justify-center text-black backdrop-blur-sm bg-white/30">
						Platz
					</div>
				</div>
				<div className="space-y-8 ">
					<p className="text-4xl font-bold text-white/60 leading-tight max-w-md">
						Manage{"  "}
						<TextFlip
							words={["works", "sectors", "disciplines", "media", "content"]}
							interval={1600}
							className="font-bold text-white/75"
						/>{" "}
						<br />
						with a streamlined admin experience.
					</p>
				</div>
				<div className="text-sm text-white/80">© {new Date().getFullYear()} Platz. All rights reserved.</div>
			</div>

			{/* Right side - form */}
			<div className="flex items-center justify-center p-6 lg:p-10">
				<Card className="w-full max-w-md border-none">
					<CardContent>
						<LoginForm onSuccess={() => router.push("/dashboard")} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
