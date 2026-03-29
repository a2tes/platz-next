"use client";

import { useEffect } from "react";

export default function ClientScripts() {
	useEffect(() => {
		// Track scroll position for CSS variable
		const handleScroll = () => {
			document.documentElement.style.setProperty("--scroll-y", `${window.scrollY}px`);
		};

		window.addEventListener("scroll", handleScroll);

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	return null;
}
