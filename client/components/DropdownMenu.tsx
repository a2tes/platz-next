"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { useRouter } from "next/navigation";

export default function DropdownMenu() {
	const router = useRouter();

	useEffect(() => {
		// Use a small timeout to ensure DOM is fully ready after navigation
		const timer = setTimeout(() => {
			const menu = document.getElementById("photographyMenu");
			const dropdown = document.getElementById("photographyMenuDropdown");
			const resetButton = document.getElementById("resetSelection");
			const photographers = document.querySelectorAll("[data-categories]");
			const categories = document.querySelectorAll("[data-photographers]");

			// Mobile Photography menu toggle
			const mobilePhotographyToggle = document.getElementById(
				"mobilePhotographyToggle"
			);
			const mobilePhotographyMenu = document.getElementById(
				"mobilePhotographyMenu"
			);
			if (mobilePhotographyToggle && mobilePhotographyMenu) {
				mobilePhotographyToggle.addEventListener("click", () => {
					const isVisible = mobilePhotographyMenu.style.display !== "none";
					mobilePhotographyMenu.style.display = isVisible ? "none" : "block";
				});
			}

			if (!menu || !dropdown) return;

			let isOpen = false;
			let selectedPhotographer: string | null = null;
			let selectedCategory: string | null = null;
			let selectionOrder: ("photographer" | "category")[] = [];

			// Initial state
			gsap.set(dropdown, {
				display: "none",
				opacity: 0,
				y: -20,
				scale: 0.95,
				position: "fixed",
			});

			function positionDropdown() {
				const buttonRect = menu.getBoundingClientRect();
				const dropdownRect = dropdown.getBoundingClientRect();
				const isMobile = window.innerWidth < 768;

				if (isMobile) {
					// Mobile: center or position relative to viewport
					gsap.set(dropdown, {
						top: Math.min(
							buttonRect.bottom + 8,
							window.innerHeight - dropdownRect.height - 20
						),
						left: Math.max(
							8,
							Math.min(
								window.innerWidth - dropdownRect.width - 8,
								buttonRect.left - (dropdownRect.width - buttonRect.width) / 2
							)
						),
					});
				} else {
					// Desktop: standard centered positioning
					gsap.set(dropdown, {
						top: buttonRect.bottom + 8,
						left: Math.max(
							8,
							buttonRect.left - (dropdownRect.width - buttonRect.width) / 2
						),
					});
				}
			}

			function openDropdown() {
				gsap.set(dropdown, {
					display: "grid",
					opacity: 0,
					y: -20,
					scale: 0.95,
				});

				requestAnimationFrame(() => {
					positionDropdown();
					gsap.to(dropdown, {
						opacity: 1,
						y: 0,
						scale: 1,
						duration: 0.3,
						ease: "back.out(1.2)",
					});
				});

				isOpen = true;
			}

			function closeDropdown() {
				requestAnimationFrame(() => {
					positionDropdown();
					gsap.to(dropdown, {
						opacity: 0,
						display: "none",
						y: -20,
						scale: 0.95,
						duration: 0.2,
						ease: "back.out(1.2)",
					});

					resetSelection();
				});
				isOpen = false;
			}

			function clearClasses(element: Element) {
				element.classList.remove(
					"selected",
					"not-selected",
					"highlighted",
					"not-highlighted",
					"disabled"
				);
			}

			function resetHighlights() {
				[...photographers, ...categories].forEach((el) => clearClasses(el));
			}

			function resetSelection() {
				selectedPhotographer = null;
				selectedCategory = null;
				selectionOrder = [];
				resetHighlights();
			}

			function highlightRelatedItems(
				itemType: "photographers" | "categories",
				relatedItems: string[]
			) {
				const stateKey =
					itemType === "photographers"
						? "selectedPhotographer"
						: "selectedCategory";
				const items = itemType === "photographers" ? photographers : categories;

				items.forEach((item) => {
					const shouldHighlight = relatedItems.includes(
						(item as HTMLElement).dataset.link || ""
					);
					const isSelected =
						(itemType === "photographers"
							? selectedPhotographer
							: selectedCategory) === (item as HTMLElement).dataset.link;

					item.classList.toggle("selected", shouldHighlight && isSelected);
					item.classList.toggle("highlighted", shouldHighlight);
					item.classList.toggle("not-highlighted", !shouldHighlight);
				});
			}

			function updateSelection(
				itemType: "photographers" | "categories",
				selectedLink: string
			) {
				const items = itemType === "photographers" ? photographers : categories;

				items.forEach((item) => {
					const isSelected =
						(item as HTMLElement).dataset.link === selectedLink;
					item.classList.toggle("selected", isSelected);
					item.classList.toggle("not-selected", !isSelected);
				});
			}

			function updateRelatedStates(
				relatedType: "photographers" | "categories",
				relatedItems: string[]
			) {
				const items =
					relatedType === "photographers" ? photographers : categories;

				items.forEach((item) => {
					clearClasses(item);
					const isRelated = relatedItems.includes(
						(item as HTMLElement).dataset.link || ""
					);
					item.classList.toggle("disabled", !isRelated);
				});
			}

			// Menu click handler
			const handleMenuClick = (e: Event) => {
				e.preventDefault();
				isOpen ? closeDropdown() : openDropdown();
			};

			// Outside click handler
			const handleOutsideClick = (e: Event) => {
				if (
					!dropdown.contains(e.target as Node) &&
					!menu.contains(e.target as Node) &&
					isOpen
				) {
					closeDropdown();
				}
			};

			// Photographer click handler
			photographers.forEach((photographer) => {
				photographer.addEventListener("click", (e) => {
					e.preventDefault();
					const link = (photographer as HTMLElement).dataset.link;

					if (selectedPhotographer === link) {
						// Second click - navigate to photography page
						closeDropdown();
						if (selectedCategory) {
							// Build URL with order: whichever was selected first
							const url =
								selectionOrder[0] === "photographer"
									? `/photography?p=${link}&c=${selectedCategory}`
									: `/photography?c=${selectedCategory}&p=${link}`;
							router.push(url);
						} else {
							router.push(`/photography?p=${link}`);
						}
						return;
					}

					selectedPhotographer = link || null;
					if (!selectionOrder.includes("photographer")) {
						selectionOrder.push("photographer");
					}
					updateSelection("photographers", link || "");

					const relatedCategories = (
						(photographer as HTMLElement).dataset.categories || ""
					)
						.split(",")
						.filter(Boolean);
					updateRelatedStates("categories", relatedCategories);

					if (selectedCategory && selectedPhotographer) {
						closeDropdown();
						const url =
							selectionOrder[0] === "photographer"
								? `/photography?p=${selectedPhotographer}&c=${selectedCategory}`
								: `/photography?c=${selectedCategory}&p=${selectedPhotographer}`;
						router.push(url);
					}
				});

				photographer.addEventListener("mouseenter", () => {
					if (!selectedPhotographer && !selectedCategory) {
						const relatedCategories = (
							(photographer as HTMLElement).dataset.categories || ""
						)
							.split(",")
							.filter(Boolean);
						highlightRelatedItems("categories", relatedCategories);
					}
				});

				photographer.addEventListener("mouseleave", () => {
					if (!selectedPhotographer && !selectedCategory) {
						resetHighlights();
					}
				});
			});

			// Category click handler
			categories.forEach((category) => {
				category.addEventListener("click", (e) => {
					e.preventDefault();
					const link = (category as HTMLElement).dataset.link;

					if (selectedCategory === link) {
						// Second click - navigate to photography page
						closeDropdown();
						if (selectedPhotographer) {
							// Build URL with order: whichever was selected first
							const url =
								selectionOrder[0] === "category"
									? `/photography?c=${link}&p=${selectedPhotographer}`
									: `/photography?p=${selectedPhotographer}&c=${link}`;
							router.push(url);
						} else {
							router.push(`/photography?c=${link}`);
						}
						return;
					}

					selectedCategory = link || null;
					if (!selectionOrder.includes("category")) {
						selectionOrder.push("category");
					}
					updateSelection("categories", link || "");

					const relatedPhotographers = (
						(category as HTMLElement).dataset.photographers || ""
					)
						.split(",")
						.filter(Boolean);
					updateRelatedStates("photographers", relatedPhotographers);

					if (selectedPhotographer && selectedCategory) {
						closeDropdown();
						const url =
							selectionOrder[0] === "category"
								? `/photography?c=${selectedCategory}&p=${selectedPhotographer}`
								: `/photography?p=${selectedPhotographer}&c=${selectedCategory}`;
						router.push(url);
					}
				});

				category.addEventListener("mouseenter", () => {
					if (!selectedPhotographer && !selectedCategory) {
						const relatedPhotographers = (
							(category as HTMLElement).dataset.photographers || ""
						)
							.split(",")
							.filter(Boolean);
						highlightRelatedItems("photographers", relatedPhotographers);
					}
				});

				category.addEventListener("mouseleave", () => {
					if (!selectedPhotographer && !selectedCategory) {
						resetHighlights();
					}
				});
			});

			// Event listeners
			menu.addEventListener("click", handleMenuClick);
			document.addEventListener("click", handleOutsideClick);
			window.addEventListener("resize", () => isOpen && positionDropdown());

			if (resetButton) {
				resetButton.addEventListener("click", resetSelection);
			}

			return () => {
				menu.removeEventListener("click", handleMenuClick);
				document.removeEventListener("click", handleOutsideClick);
			};
		}, 100);

		return () => clearTimeout(timer);
	}, [router]);

	return null;
}
