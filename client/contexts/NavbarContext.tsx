"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getApiUrl } from "@/lib/utils";

interface Photographer {
	title: string;
	slug: string;
	categories: string[];
}

interface PhotoCategory {
	title: string;
	slug: string;
	photographers: string[];
}

interface ContentPage {
	title: string;
	slug: string;
	type: "ABOUT" | "CONTACT";
}

interface NavbarData {
	photographers: Photographer[];
	categories: PhotoCategory[];
	pages: ContentPage[];
	loading: boolean;
}

const NavbarContext = createContext<NavbarData>({
	photographers: [],
	categories: [],
	pages: [],
	loading: true,
});

export function NavbarProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<NavbarData>({
		photographers: [],
		categories: [],
		pages: [],
		loading: true,
	});

	useEffect(() => {
		// Only fetch if not already loaded
		if (!data.loading || data.photographers.length > 0) return;

		let isMounted = true;

		const fetchNavbarData = async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/navbar`);
				if (res.ok && isMounted) {
					const json = await res.json();
					setData({
						photographers: json.photographers || [],
						categories: json.categories || [],
						pages: json.pages || [],
						loading: false,
					});
				}
			} catch (error) {
				console.error("Failed to fetch navbar data:", error);
				if (isMounted) {
					setData((prev) => ({ ...prev, loading: false }));
				}
			}
		};

		fetchNavbarData();

		return () => {
			isMounted = false;
		};
	}, []);

	return <NavbarContext.Provider value={data}>{children}</NavbarContext.Provider>;
}

export function useNavbarData() {
	return useContext(NavbarContext);
}
