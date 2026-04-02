"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useNavbarData } from "@/contexts/NavbarContext";

export default function Navbar({ theme = "light", fixed = false }: { theme?: "light" | "dark"; fixed?: boolean }) {
	const pathname = usePathname();
	const { pages, loading } = useNavbarData();
	const [drawerOpen, setDrawerOpen] = useState(false);

	// Helper to check if a page type exists
	const hasPage = (type: "ABOUT" | "CONTACT") => pages.some((p) => p.type === type);

	useEffect(() => {
		// Close mobile menu when navigation changes
		setDrawerOpen(false);
	}, [pathname]);

	const handleDrawerOpenChange = (open: boolean) => {
		setDrawerOpen(open);
		// If closing, return focus to hamburger button
		if (!open) {
			setTimeout(() => {
				const hamburger = document.querySelector(".hamburger-btn") as HTMLButtonElement;
				hamburger?.focus();
			}, 0);
		}
	};

	useEffect(() => {
		const logo = document.querySelector(".navbar-brand");
		if (!logo) return;

		logo.innerHTML = `
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 270" class="h-6 w-auto">
        <path class="logo-fill" fill="none" d="M158 76c-7-6-13-10-20-13-7-2-14-4-20-4-8 0-15 2-20 6s-8 9-8 15c0 4 1 8 4 10 2 3 6 6 10 8l14 5 15 5c21 7 36 16 45 27 10 12 15 27 15 45 0 12-2 24-6 33-4 11-10 19-18 26s-18 13-30 17a146 146 0 01-125-21l28-51c9 8 18 14 28 18s18 6 27 6c10 0 18-2 23-7 5-4 7-10 7-16l-1-9-7-7c-3-3-7-5-12-6l-17-7-24-8c-8-4-15-8-21-13s-11-11-15-19-5-18-5-30 1-23 6-33c3-10 9-18 16-25a93 93 0 0161-21 154 154 0 0175 19l-25 50z"></path>
        <path class="logo-fill" fill="none" d="M277 112L358 7h82L339 128l111 135h-87l-86-112v111h-66V7h66v105z"></path>
        <ellipse class="logo-stroke" stroke-width="70" stroke="none" fill="none" cx="551" cy="135" rx="100" ry="100"></ellipse>
        <path class="logo-fill" fill="none" d="M773 112L854 7h82L835 128l110 134h-86l-86-111v111h-66V7h66v105z"></path>
      </svg>
    `;
	}, []);

	const navClasses = `navbar-${theme}${fixed ? " navbar-fixed" : ""}`;

	return (
		<nav className={navClasses}>
			<Link href="/" className="navbar-brand">
				Platz Agency
			</Link>

			{/* Mobile Drawer Menu */}
			<Drawer open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
				<DrawerTrigger asChild>
					<div className={`burger-container md:!hidden ${drawerOpen ? "active" : ""}`}>
						<div className="burger"></div>
					</div>
				</DrawerTrigger>
				<DrawerContent>
					<DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
					<DrawerDescription className="sr-only">Main navigation menu</DrawerDescription>
					<div className="w-full px-4 py-6 space-y-4">
						<Link
							href="/works"
							className={`block py-2 text-lg font-semibold transition-opacity hover:opacity-70 ${
								pathname === "/works" ? "opacity-100" : "opacity-80"
							}`}
						>
							WORKS
						</Link>
						{hasPage("ABOUT") && (
							<Link
								href="/about"
								className={`block py-2 text-lg font-semibold transition-opacity hover:opacity-70 ${
									pathname === "/about" ? "opacity-100" : "opacity-80"
								}`}
							>
								ABOUT
							</Link>
						)}
						{hasPage("CONTACT") && (
							<Link
								href="/contact"
								className={`block py-2 text-lg font-semibold transition-opacity hover:opacity-70 ${
									pathname === "/contact" ? "opacity-100" : "opacity-80"
								}`}
							>
								CONTACT
							</Link>
						)}
					</div>
				</DrawerContent>
			</Drawer>

			{/* Desktop Menu */}
			<ul
				className={`nav-menu hidden md:flex ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
			>
				<li>
					<Link href="/works" className={`nav-link ${pathname === "/works" ? "active" : ""}`}>
						WORKS<span></span>
					</Link>
				</li>
				{hasPage("ABOUT") && (
					<li>
						<Link href="/about" className={`nav-link ${pathname === "/about" ? "active" : ""}`}>
							ABOUT<span></span>
						</Link>
					</li>
				)}
				{hasPage("CONTACT") && (
					<li>
						<Link href="/contact" className={`nav-link ${pathname === "/contact" ? "active" : ""}`}>
							CONTACT<span></span>
						</Link>
					</li>
				)}
			</ul>
		</nav>
	);
}
