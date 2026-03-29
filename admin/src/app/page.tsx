"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/authStore";

export default function Home() {
	const router = useRouter();
	const { isAuthenticated, isLoading } = useAuth();

	useEffect(() => {
		if (isLoading) return;

		if (isAuthenticated) {
			router.replace("/dashboard");
		} else {
			router.replace("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	// Show loading state while checking auth
	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	);
}
