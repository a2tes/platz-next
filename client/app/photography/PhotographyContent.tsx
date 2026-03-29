"use client";

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { gsap } from "gsap";
import { useRouter, useSearchParams, notFound } from "next/navigation";
import { AnimatePresence } from "motion/react";
import Masonry from "react-masonry-css";
import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import MouseTrail from "@/components/MouseTrail";
import dynamic from "next/dynamic";
import PhotoModal, { CardRect, Photo } from "@/components/photography/PhotoModal";
import EditorContent from "@/components/EditorContent";
import { getApiUrl } from "@/lib/utils";

const DropdownMenu = dynamic(() => import("@/components/DropdownMenu"), {
	ssr: false,
});

type GalleryItem = Photo & {
	year: string;
	location: string;
	categories?: { title: string; slug: string }[];
	clientSlug?: string;
};

interface Photographer {
	title: string;
	slug: string;
	bio?: string | null;
	coverImage?: string | null;
	avatar?: string | null;
	groupByClient?: boolean;
}

interface PhotoCategory {
	title: string;
	slug: string;
}

interface PhotoClient {
	title: string;
	slug: string;
}

interface ClientGroup {
	title: string;
	slug: string;
	cover: any;
	count: number;
}

interface SelectedGroup {
	title: string;
	slug: string;
}

// Breakpoint columns for masonry
const breakpointColumnsObj = {
	default: 4,
	1024: 3,
	768: 2,
	480: 1,
};

// Gallery Item Component
function GalleryItemCard({
	item,
	badgeText,
	onSelect,
}: {
	item: GalleryItem;
	badgeText: string;
	onSelect: (item: GalleryItem, rect: CardRect) => void;
}) {
	const cardRef = useRef<HTMLDivElement>(null);
	const [isLoaded, setIsLoaded] = useState(false);

	const handleClick = () => {
		if (cardRef.current) {
			const rect = cardRef.current.getBoundingClientRect();
			onSelect(item, {
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
			});
		}
	};

	return (
		<div className="p-2">
			<div
				ref={cardRef}
				className="bg-white rounded-lg overflow-hidden cursor-pointer relative group"
				onClick={handleClick}
			>
				<div className="w-full overflow-hidden">
					<img
						src={item.images?.medium || item.images?.original || ""}
						alt={item.title}
						className={`w-full h-auto object-cover transition-all duration-500 ease-out group-hover:scale-[1.03] ${
							isLoaded ? "bg-transparent" : "bg-gray-200"
						}`}
						loading="lazy"
						onLoad={() => setIsLoaded(true)}
					/>
				</div>
				<div className="absolute inset-0 bg-transparent group-hover:bg-black/20 transition-colors duration-500 ease-out flex items-center justify-center pointer-events-none">
					<div className="text-white text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out">
						{item.title}
					</div>
				</div>
				<div className="absolute top-2 right-2 bg-black/10 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium pointer-events-none">
					{badgeText}
				</div>
			</div>
		</div>
	);
}

function PhotographyContentInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
	const [photographers, setPhotographers] = useState<Photographer[]>([]);
	const [categories, setCategories] = useState<PhotoCategory[]>([]);
	const [clients, setClients] = useState<PhotoClient[]>([]);
	const [currentPhotographer, setCurrentPhotographer] = useState<Photographer | null>(null);
	const [currentClient, setCurrentClient] = useState<PhotoClient | null>(null);
	const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
	const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isNotFound, setIsNotFound] = useState(false);
	const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);
	const [selectedCardRect, setSelectedCardRect] = useState<CardRect | null>(null);
	const [activeTab, setActiveTab] = useState("all");
	const tabIndicatorRef = useRef<HTMLDivElement>(null);
	const tabsContainerRef = useRef<HTMLDivElement>(null);

	// Get photographer, category, and client from URL
	const photographerId = searchParams.get("p");
	const categoryId = searchParams.get("c");
	const groupSlug = searchParams.get("g"); // g for client group within photographer

	// Determine primary view based on first search parameter
	const searchParamKeys = Array.from(searchParams.keys());
	const photoIndex = searchParamKeys.indexOf("p");
	const catIndex = searchParamKeys.indexOf("c");
	// g is now a secondary filter for photographer pages, not a primary filter
	const isPrimaryPhotographer = photoIndex !== -1 && (catIndex === -1 || photoIndex < catIndex);
	const isPrimaryCategory = catIndex !== -1 && (photoIndex === -1 || catIndex < photoIndex);
	const isPrimaryClient = false; // Disabled - g is now for client groups within photographer
	const primaryFilter = isPrimaryPhotographer ? photographerId : isPrimaryCategory ? categoryId : null;

	// Get relevant tabs based on primary view
	// Show categories on photographer page (not inside a group)
	// Show photographers on category page
	const relevantPhotographers = isPrimaryCategory ? photographers : [];
	const relevantCategories = isPrimaryPhotographer && !groupSlug ? categories : [];

	// Initialize active tab from URL
	useEffect(() => {
		let initialFilter = "all";
		if (isPrimaryCategory) {
			initialFilter = photographerId || "all";
		} else if (isPrimaryPhotographer) {
			initialFilter = categoryId || "all";
		}
		setActiveTab(initialFilter);
	}, [isPrimaryCategory, isPrimaryPhotographer, photographerId, categoryId]);

	if (isNotFound) {
		notFound();
	}

	// Fetch gallery data from API
	useEffect(() => {
		const fetchGalleryData = async () => {
			try {
				setIsLoading(true);
				const query = new URLSearchParams();

				if (isPrimaryPhotographer && photographerId) {
					query.set("photographer", photographerId);
					// Add group parameter if filtering by client group
					if (groupSlug) {
						query.set("group", groupSlug);
					}
				} else if (isPrimaryCategory && categoryId) {
					query.set("category", categoryId);
				} else if (groupSlug) {
					// Main page with group filter
					query.set("group", groupSlug);
				}

				const response = await fetch(`${getApiUrl()}/api/public/photography?${query.toString()}`);

				if (response.status === 404) {
					setIsNotFound(true);
					return;
				}

				if (!response.ok) throw new Error("Failed to fetch gallery data");

				const data = await response.json();

				// Check if secondary filter is valid
				if (isPrimaryPhotographer && categoryId) {
					const hasCategory = data.categories?.some((c: PhotoCategory) => c.slug === categoryId);
					if (!hasCategory) {
						setIsNotFound(true);
						return;
					}
				} else if (isPrimaryCategory && photographerId) {
					const hasPhotographer = data.photographers?.some((p: Photographer) => p.slug === photographerId);
					if (!hasPhotographer) {
						setIsNotFound(true);
						return;
					}
				}

				setGalleryItems(data.items || []);
				setPhotographers(data.photographers || []);
				setCategories(data.categories || []);
				setClients(data.clients || []);
				setCurrentPhotographer(data.photographer || null);
				setCurrentClient(data.client || null);
				setClientGroups(data.clientGroups || []);
				setSelectedGroup(data.selectedGroup || null);
			} catch (error) {
				console.error("Error fetching gallery data:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchGalleryData();
	}, [primaryFilter, isPrimaryPhotographer, isPrimaryCategory, groupSlug]);

	// Filter gallery items based on active tab
	const filteredItems = useMemo(() => {
		if (activeTab === "all") {
			return galleryItems;
		}

		return galleryItems.filter((item) => {
			if (isPrimaryCategory) {
				return item.photographer?.slug === activeTab;
			} else if (isPrimaryPhotographer) {
				return item.category?.slug === activeTab;
			}
			return true;
		});
	}, [galleryItems, activeTab, isPrimaryCategory, isPrimaryPhotographer]);

	// Filter client groups based on active category tab
	// When a category is selected, only show groups that have photos in that category
	const filteredClientGroups = useMemo(() => {
		if (activeTab === "all" || !isPrimaryPhotographer) {
			return clientGroups;
		}

		// Build groups from filtered items
		const clientGroupsMap = new Map<string, { title: string; slug: string; cover: any; count: number }>();
		const uncategorizedItems: any[] = [];

		for (const item of galleryItems) {
			// Check if item belongs to selected category
			const belongsToCategory =
				item.categories?.some((c: any) => c.slug === activeTab) || item.category?.slug === activeTab;
			if (!belongsToCategory) continue;

			if (item.clientSlug) {
				if (!clientGroupsMap.has(item.clientSlug)) {
					clientGroupsMap.set(item.clientSlug, {
						title: item.client,
						slug: item.clientSlug,
						cover: item.images,
						count: 1,
					});
				} else {
					const group = clientGroupsMap.get(item.clientSlug)!;
					group.count++;
				}
			} else {
				uncategorizedItems.push(item);
			}
		}

		const groups = Array.from(clientGroupsMap.values());
		if (uncategorizedItems.length > 0) {
			groups.push({
				title: "Uncategorized",
				slug: "_uncategorized",
				cover: uncategorizedItems[0]?.images || null,
				count: uncategorizedItems.length,
			});
		}

		return groups;
	}, [galleryItems, activeTab, isPrimaryPhotographer, clientGroups]);

	// Update tab indicator position
	const updateTabIndicator = useCallback((tabValue: string, animate = true) => {
		if (!tabIndicatorRef.current || !tabsContainerRef.current) return;

		const button = tabsContainerRef.current.querySelector(`[data-tab="${tabValue}"]`) as HTMLElement;
		if (!button) return;

		const buttonRect = button.getBoundingClientRect();
		const containerRect = tabsContainerRef.current.getBoundingClientRect();
		const left = buttonRect.left - containerRect.left;
		const width = buttonRect.width;

		if (animate) {
			gsap.to(tabIndicatorRef.current, {
				x: left,
				width: width,
				duration: 0.3,
				ease: "power2.out",
			});
		} else {
			gsap.set(tabIndicatorRef.current, {
				x: left,
				width: width,
			});
		}
	}, []);

	// Update indicator when active tab changes
	useEffect(() => {
		// Small delay to ensure DOM is ready
		const timer = setTimeout(() => {
			updateTabIndicator(activeTab, false);
		}, 100);
		return () => clearTimeout(timer);
	}, [activeTab, relevantCategories, relevantPhotographers, updateTabIndicator]);

	// Handle tab click
	const handleTabClick = (tabValue: string) => {
		setActiveTab(tabValue);
		updateTabIndicator(tabValue, true);
		updateURL(tabValue);
	};

	// Handle client group click - navigate to group view
	const handleGroupClick = (group: ClientGroup) => {
		const params = new URLSearchParams();
		if (photographerId) {
			params.set("p", photographerId);
		}
		params.set("g", group.slug);
		router.push(`${window.location.pathname}?${params.toString()}`);
	};

	// Handle back from group view
	const handleBackFromGroup = () => {
		const params = new URLSearchParams();
		if (photographerId) {
			params.set("p", photographerId);
		}
		const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
		router.push(newURL);
	};

	// Update URL without page reload
	const updateURL = (filterValue: string) => {
		const params = new URLSearchParams();

		if (isPrimaryCategory && categoryId) {
			params.set("c", categoryId);
			if (filterValue !== "all") {
				params.set("p", filterValue);
			}
		} else if (isPrimaryPhotographer && photographerId) {
			params.set("p", photographerId);
			if (groupSlug) {
				params.set("g", groupSlug);
			}
			if (filterValue !== "all") {
				params.set("c", filterValue);
			}
		}

		const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
		window.history.replaceState(null, "", newURL);
	};

	// Handle photo selection
	const handleSelectPhoto = (item: GalleryItem, rect: CardRect) => {
		setSelectedCardRect(rect);
		setSelectedPhoto(item);
	};

	const handleCloseModal = () => {
		setSelectedPhoto(null);
		setSelectedCardRect(null);
	};

	// Get badge text based on view
	const getBadgeText = (item: GalleryItem) => {
		if (isPrimaryCategory) {
			return item.photographer?.title;
		}
		return item.category?.title;
	};

	// Get page title based on view
	const getPageTitle = () => {
		if (selectedGroup) {
			return selectedGroup.title;
		}
		if (isPrimaryPhotographer && currentPhotographer) {
			return currentPhotographer.title;
		}
		return "Photography";
	};

	// Should show client groups (main page or photographer page with groupByClient and no group selected)
	// When a category is selected (activeTab !== 'all'), show groups filtered by that category
	const isMainPage = !isPrimaryPhotographer && !isPrimaryCategory;
	// Only show client groups if photographer has groupByClient enabled (default true)
	const photographerGroupByClient = currentPhotographer?.groupByClient !== false;
	const shouldShowClientGroups = filteredClientGroups.length > 0 && !groupSlug && photographerGroupByClient;

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="dark" fixed={isPrimaryPhotographer && currentPhotographer?.coverImage ? true : false} />
			<DropdownMenu />
			<div
				className={`relative px-8 overflow-hidden ${
					isPrimaryPhotographer && currentPhotographer?.coverImage ? "pt-22" : "pt-4"
				}`}
			>
				{/* Cover image background for photographer */}
				{isPrimaryPhotographer && currentPhotographer?.coverImage && (
					<div className="absolute inset-0 -z-10">
						<img src={currentPhotographer.coverImage} alt="" className="w-full h-full object-cover opacity-80" />
						<div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white" />
					</div>
				)}
				{/* Avatar for photographer */}
				{isPrimaryPhotographer && currentPhotographer?.avatar && (
					<div className="flex justify-center pt-8">
						<div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
							<img
								src={currentPhotographer.avatar}
								alt={currentPhotographer.title}
								className="w-full h-full object-cover"
							/>
						</div>
					</div>
				)}
				<h1
					className={`font-extrabold text-center pb-2 md:pb-4 text-8xl relative ${
						isPrimaryPhotographer && currentPhotographer?.avatar ? "pt-4 md:pt-6" : "pt-4 md:pt-16"
					}`}
					id="photographerName"
				>
					{isPrimaryPhotographer
						? currentPhotographer?.title ||
							photographerId
								?.split("-")
								.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
								.join(" ")
						: categoryId
							? categoryId
									.split("-")
									.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
									.join(" ")
							: "Photography"}
				</h1>
				{isPrimaryPhotographer && currentPhotographer?.bio && (
					<div className="max-w-3xl mx-auto pb-4 md:pb-8 px-4">
						{(() => {
							try {
								const bioData = JSON.parse(currentPhotographer.bio);
								return <EditorContent data={bioData} />;
							} catch {
								return <p>{currentPhotographer.bio}</p>;
							}
						})()}
					</div>
				)}
			</div>

			{/* Back button when viewing a group - replaces tabs */}
			{selectedGroup && (
				<div className="flex flex-col items-center mb-8">
					<h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">{selectedGroup.title}</h2>
					<button
						onClick={handleBackFromGroup}
						className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-lg"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M19 12H5M12 19l-7-7 7-7" />
						</svg>
						<span>View all clients</span>
					</button>
				</div>
			)}

			{/* Tabs - shown on photographer page (not inside a group) */}
			{isPrimaryPhotographer && !groupSlug && relevantCategories.length > 0 && (
				<div className="flex justify-center mb-8">
					<div className="tab-links">
						<div id="tabIndicator" ref={tabIndicatorRef}></div>
						<div id="tabsContainer" ref={tabsContainerRef}>
							<button
								type="button"
								data-tab="all"
								className={`tab-button ${activeTab === "all" ? "active" : ""}`}
								onClick={() => handleTabClick("all")}
							>
								All
							</button>
							{relevantCategories.map((cat) => (
								<button
									key={cat.slug}
									type="button"
									data-tab={cat.slug}
									className={`tab-button ${activeTab === cat.slug ? "active" : ""}`}
									onClick={() => handleTabClick(cat.slug)}
								>
									{cat.title.charAt(0).toUpperCase() + cat.title.slice(1)}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Tabs for category page */}
			{isPrimaryCategory && relevantPhotographers.length > 0 && (
				<div className="flex justify-center mb-8">
					<div className="tab-links">
						<div id="tabIndicator" ref={tabIndicatorRef}></div>
						<div id="tabsContainer" ref={tabsContainerRef}>
							<button
								type="button"
								data-tab="all"
								className={`tab-button ${activeTab === "all" ? "active" : ""}`}
								onClick={() => handleTabClick("all")}
							>
								All
							</button>
							{relevantPhotographers.map((photographer) => (
								<button
									key={photographer.slug}
									type="button"
									data-tab={photographer.slug}
									className={`tab-button ${activeTab === photographer.slug ? "active" : ""}`}
									onClick={() => handleTabClick(photographer.slug)}
								>
									{photographer.title}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Client Groups Masonry - shown when photographer has groupByClient enabled */}
			{shouldShowClientGroups && (
				<div className="mx-2">
					<Masonry breakpointCols={breakpointColumnsObj} className="masonry-grid" columnClassName="masonry-grid-column">
						{filteredClientGroups.map((group) => (
							<div key={group.slug} className="p-2">
								<div
									className="bg-white rounded-lg overflow-hidden cursor-pointer relative group"
									onClick={() => handleGroupClick(group)}
								>
									<div className="w-full overflow-hidden">
										<img
											src={group.cover?.medium || group.cover?.original || ""}
											alt={group.title}
											className="w-full h-auto object-cover transition-all duration-500 ease-out group-hover:scale-[1.03]"
											loading="lazy"
										/>
									</div>
									<div className="absolute inset-0 bg-transparent group-hover:bg-black/30 transition-colors duration-500 ease-out flex flex-col items-center justify-center pointer-events-none">
										<div className="text-white text-xl font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out drop-shadow-lg">
											{group.title}
										</div>
										<div className="text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out drop-shadow-lg mt-1">
											{group.count} {group.count === 1 ? "photo" : "photos"}
										</div>
									</div>
									<div className="absolute top-2 right-2 bg-black/10 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium pointer-events-none">
										{group.count}
									</div>
								</div>
							</div>
						))}
					</Masonry>
				</div>
			)}

			{/* Masonry Gallery - shown when not showing client groups */}
			{!shouldShowClientGroups && (
				<div className="mx-2">
					<Masonry breakpointCols={breakpointColumnsObj} className="masonry-grid" columnClassName="masonry-grid-column">
						{filteredItems.map((item) => (
							<GalleryItemCard
								key={item.slug}
								item={item}
								badgeText={getBadgeText(item)}
								onSelect={handleSelectPhoto}
							/>
						))}
					</Masonry>
				</div>
			)}

			<AnimatePresence>
				{selectedPhoto && (
					<PhotoModal
						photo={selectedPhoto}
						cardRect={selectedCardRect}
						onClose={handleCloseModal}
						allPhotos={filteredItems}
						currentFilter={isPrimaryPhotographer ? categoryId : isPrimaryCategory ? photographerId : null}
						filterType={isPrimaryPhotographer ? "category" : isPrimaryCategory ? "photographer" : undefined}
						onNavigate={(photo) => setSelectedPhoto(photo as GalleryItem)}
					/>
				)}
			</AnimatePresence>
		</>
	);
}

export default function PhotographyContent() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<PhotographyContentInner />
		</Suspense>
	);
}
