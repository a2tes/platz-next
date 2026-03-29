"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../stores/authStore";

export default function SettingsPage() {
	const router = useRouter();
	const { user } = useAuthStore();

	useEffect(() => {
		if (user?.role === "ADMIN") {
			router.replace("/settings/general");
		} else {
			router.replace("/settings/profile");
		}
	}, [user, router]);

	return null;
}
