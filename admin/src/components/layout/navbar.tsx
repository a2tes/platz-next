"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserProfile } from "./user-profile";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { useAuthStore } from "@/stores/authStore";

const pages = [
	{ name: "Homepage", href: "/homepage" },
	{ name: "About", href: "/about" },
	{ name: "Contact", href: "/contact" },
	{ name: "Legal", href: "/legal" },
];

const taxonomiesLinks = [
	{ name: "Clients", href: "/taxonomies/clients" },
	{ name: "Disciplines", href: "/taxonomies/disciplines" },
	{ name: "Sectors", href: "/taxonomies/sectors" },
];

function NavSection({
	label,
	links,
	pathname,
	open,
	onToggle,
}: {
	label: string;
	links: { name: string; href: string }[];
	pathname: string;
	open: boolean;
	onToggle: () => void;
}) {
	const isActive = links.some((l) =>
		l.href === "/" + label.toLowerCase() ? pathname === l.href : pathname.startsWith(l.href),
	);

	return (
		<Collapsible open={open} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
				<span className={cn(isActive && "text-foreground")}>{label}</span>
				<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-0.5 pl-3 pt-0.5">
				{links.map((link) => {
					const linkActive = link.href === "/works" ? pathname === link.href : pathname.startsWith(link.href);
					return (
						<Link
							key={link.href}
							href={link.href}
							className={cn(
								"rounded-md px-3 py-1.5 text-sm transition-colors",
								linkActive
									? "bg-accent text-accent-foreground font-medium"
									: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
							)}
						>
							{link.name}
						</Link>
					);
				})}
			</CollapsibleContent>
		</Collapsible>
	);
}

function SidebarContent({ pathname, user }: { pathname: string; user: { role?: string } | null }) {
	const { openModal } = useMediaLibraryStore();

	const sections = ["Pages", "Taxonomies"] as const;
	const initialOpen = sections.find((s) => {
		const links = { Pages: pages, Taxonomies: taxonomiesLinks }[s];
		return links.some((l) => pathname.startsWith(l.href));
	});
	const [openSection, setOpenSection] = React.useState<string | null>(initialOpen ?? null);

	const toggle = (label: string) => {
		setOpenSection((prev) => (prev === label ? null : label));
	};

	return (
		<nav className="flex flex-col gap-1 px-2 py-2 flex-1">
			<Link
				href="/dashboard"
				className={cn(
					"rounded-md px-3 py-2 text-sm font-medium transition-colors",
					pathname === "/dashboard"
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
				)}
			>
				Dashboard
			</Link>

			<NavSection
				label="Pages"
				links={pages}
				pathname={pathname}
				open={openSection === "Pages"}
				onToggle={() => toggle("Pages")}
			/>
			<Link
				href="/works"
				className={cn(
					"rounded-md px-3 py-2 text-sm font-medium transition-colors",
					pathname === "/works" || pathname.startsWith("/works/")
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
				)}
			>
				Works
			</Link>
			{user?.role === "ADMIN" && (
				<Link
					href="/presentations"
					className={cn(
						"rounded-md px-3 py-2 text-sm font-medium transition-colors",
						pathname.startsWith("/presentations")
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
					)}
				>
					Presentations
				</Link>
			)}
			<NavSection
				label="Taxonomies"
				links={taxonomiesLinks}
				pathname={pathname}
				open={openSection === "Taxonomies"}
				onToggle={() => toggle("Taxonomies")}
			/>

			<button
				onClick={() => openModal()}
				className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors text-left"
			>
				Media Library
			</button>

			{user?.role === "ADMIN" && (
				<Link
					href="/users"
					className={cn(
						"rounded-md px-3 py-2 text-sm font-medium transition-colors",
						pathname.startsWith("/users")
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
					)}
				>
					Users
				</Link>
			)}

			{user?.role === "ADMIN" && (
				<Link
					href="/settings"
					className={cn(
						"rounded-md px-3 py-2 text-sm font-medium transition-colors",
						pathname.startsWith("/settings")
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
					)}
				>
					Settings
				</Link>
			)}
		</nav>
	);
}

export function Sidebar() {
	const pathname = usePathname();
	const { user } = useAuthStore();

	return (
		<>
			{/* Desktop Sidebar */}
			<aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 z-40 border-r bg-background">
				{/* Logo */}
				<div className="flex h-14 items-center px-4 border-b">
					<Link href="/dashboard" className="flex items-center space-x-1">
						<div className="h-8 px-1 rounded bg-primary flex items-center justify-center">
							<span className="text-primary-foreground font-bold text-sm">Platz</span>
						</div>
					</Link>
				</div>

				{/* Navigation */}
				<div className="flex-1 overflow-y-auto">
					<SidebarContent pathname={pathname} user={user} />
				</div>
			</aside>

			{/* Desktop Top Bar */}
			<header className="hidden md:flex fixed top-0 right-0 left-56 z-40 h-14 items-center justify-end border-b bg-background px-6">
				<UserProfile />
			</header>

			{/* Mobile Header */}
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur md:hidden">
				<div className="flex h-14 items-center px-4">
					<Sheet>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" className="mr-2">
								<Menu className="h-5 w-5" />
								<span className="sr-only">Toggle menu</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-[280px] p-0">
							<SheetTitle className="sr-only">Navigation</SheetTitle>
							<div className="flex h-14 items-center px-4 border-b">
								<Link href="/dashboard" className="flex items-center space-x-1">
									<div className="h-8 px-1 rounded bg-primary flex items-center justify-center">
										<span className="text-primary-foreground font-bold text-sm">Platz</span>
									</div>
								</Link>
							</div>
							<div className="overflow-y-auto h-[calc(100vh-3.5rem)]">
								<SidebarContent pathname={pathname} user={user} />
							</div>
						</SheetContent>
					</Sheet>

					<Link href="/dashboard" className="flex items-center space-x-1">
						<div className="h-8 px-1 rounded bg-primary flex items-center justify-center">
							<span className="text-primary-foreground font-bold text-sm">Platz</span>
						</div>
					</Link>

					<div className="ml-auto">
						<UserProfile />
					</div>
				</div>
			</header>
		</>
	);
}
