"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getApiUrl } from "@/lib/utils";

interface ContentPage {
	title: string;
	slug: string;
	type: "ABOUT" | "CONTACT";
}

interface NavbarData {
	pages: ContentPage[];
	loading: boolean;
}

const NavbarContext = createContext<NavbarData>({
	pages: [],
	loading: true,
});

export function NavbarProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<NavbarData>({
		pages: [],
		loading: true,
	});

	useEffect(() => {
		if (!data.loading) return;

		let isMounted = true;

		const fetchNavbarData = async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/navbar`);
				if (res.ok && isMounted) {
					const json = await res.json();
					setData({
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
