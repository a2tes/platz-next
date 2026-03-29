"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { IconInfoCircle, IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

/**
 * Apply ImageKit height transformation to image URL for modal display
 * Limits image height to 960px for faster loading
 */
function getOptimizedModalUrl(url: string | undefined, maxHeight: number = 960): string {
	if (!url) return "";

	try {
		const urlObj = new URL(url);
		// Check if it's an ImageKit URL
		if (urlObj.hostname.includes("imagekit.io") || urlObj.hostname.includes("ik.imagekit.io")) {
			const existingTr = urlObj.searchParams.get("tr") || "";
			const transforms: string[] = existingTr ? existingTr.split(",") : [];

			// Remove any existing height transforms
			const filteredTransforms = transforms.filter((t) => !t.startsWith("h-"));
			// Add max height transform
			filteredTransforms.push(`h-${maxHeight}`);

			urlObj.searchParams.set("tr", filteredTransforms.join(","));
			return urlObj.href;
		}
		return url;
	} catch {
		return url || "";
	}
}

export interface Photo {
	title: string;
	slug: string;
	year?: string;
	description?: string;
	location?: string;
	client?: string;
	images: {
		original: string;
		large: string;
		medium: string;
		small: string;
		thumbnail: string;
	} | null;
	photographer: { title: string; slug: string };
	category: { title: string; slug: string };
}

export interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface PhotoModalProps {
	photo: Photo | null;
	cardRect: CardRect | null;
	onClose: () => void;
	allPhotos?: Photo[];
	currentFilter?: string | null; // category or photographer slug for secondary filter
	filterType?: "category" | "photographer"; // what the currentFilter represents
	onNavigate?: (photo: Photo) => void;
}

export default function PhotoModal({
	photo,
	cardRect,
	onClose,
	allPhotos = [],
	currentFilter,
	filterType,
	onNavigate,
}: PhotoModalProps) {
	const [isInfoVisible, setIsInfoVisible] = useState(true);
	const [mounted, setMounted] = useState(false);
	const hideInfoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Calculate filtered photos based on current filter
	const filteredPhotos = useCallback(() => {
		if (!currentFilter || !filterType || allPhotos.length === 0) {
			return allPhotos;
		}
		return allPhotos.filter((p) => {
			if (filterType === "category") {
				return p.category?.slug === currentFilter;
			} else if (filterType === "photographer") {
				return p.photographer?.slug === currentFilter;
			}
			return true;
		});
	}, [allPhotos, currentFilter, filterType]);

	const getFilteredItems = filteredPhotos();
	const currentIndex = photo ? getFilteredItems.findIndex((p) => p.slug === photo.slug) : -1;
	const hasNavigation = getFilteredItems.length > 1 && onNavigate;

	const goToPrevious = useCallback(() => {
		if (!hasNavigation || currentIndex === -1) return;
		const prevIndex = currentIndex === 0 ? getFilteredItems.length - 1 : currentIndex - 1;
		onNavigate?.(getFilteredItems[prevIndex]);
	}, [hasNavigation, currentIndex, getFilteredItems, onNavigate]);

	const goToNext = useCallback(() => {
		if (!hasNavigation || currentIndex === -1) return;
		const nextIndex = currentIndex === getFilteredItems.length - 1 ? 0 : currentIndex + 1;
		onNavigate?.(getFilteredItems[nextIndex]);
	}, [hasNavigation, currentIndex, getFilteredItems, onNavigate]);

	// Handle client-side mounting for portal
	useEffect(() => {
		setMounted(true);
	}, []);

	// Lock body scroll when modal is open
	useEffect(() => {
		if (photo) {
			document.body.style.overflow = "hidden";

			// Auto-hide info after 5 seconds
			hideInfoTimeoutRef.current = setTimeout(() => {
				setIsInfoVisible(false);
			}, 5000);

			return () => {
				// Always restore scroll on cleanup
				document.body.style.overflow = "";
				if (hideInfoTimeoutRef.current) {
					clearTimeout(hideInfoTimeoutRef.current);
				}
			};
		} else {
			document.body.style.overflow = "";
			setIsInfoVisible(true);
		}
	}, [photo]);

	// Keyboard handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			} else if (e.key === "ArrowLeft") {
				goToPrevious();
			} else if (e.key === "ArrowRight") {
				goToNext();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose, goToPrevious, goToNext]);

	const toggleInfo = () => {
		setIsInfoVisible(!isInfoVisible);
		if (hideInfoTimeoutRef.current) {
			clearTimeout(hideInfoTimeoutRef.current);
		}
	};

	if (!mounted || !photo || !cardRect) return null;

	return createPortal(
		<>
			{/* Backdrop */}
			<motion.div
				key="photo-modal-backdrop"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.4 }}
				className="fixed inset-0 bg-white z-50"
				onClick={onClose}
			/>

			{/* Modal content - animates from card position to fullscreen */}
			<motion.div
				key="photo-modal-content"
				initial={{
					position: "fixed",
					top: cardRect.top,
					left: cardRect.left,
					width: cardRect.width,
					height: cardRect.height,
					zIndex: 51,
				}}
				animate={{
					top: 0,
					left: 0,
					width: "100vw",
					height: "100vh",
				}}
				exit={{
					top: cardRect.top,
					left: cardRect.left,
					width: cardRect.width,
					height: cardRect.height,
					opacity: 0,
				}}
				transition={{
					type: "spring",
					stiffness: 300,
					damping: 30,
				}}
				className="overflow-hidden bg-transparent flex items-center justify-center max-h-full"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Photo */}
				<AnimatePresence mode="wait">
					<motion.img
						key={photo.slug}
						src={getOptimizedModalUrl(photo.images?.original, 1500)}
						alt={photo.title}
						className="max-w-full max-h-full w-full object-contain"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
					/>
				</AnimatePresence>

				{/* Navigation Arrows */}
				{hasNavigation && (
					<>
						{/* Previous Button */}
						<motion.button
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.5 }}
							onClick={(e) => {
								e.stopPropagation();
								goToPrevious();
							}}
							className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300 z-50"
							aria-label="Önceki fotoğraf"
						>
							<IconChevronLeft size={28} />
						</motion.button>

						{/* Next Button */}
						<motion.button
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.5 }}
							onClick={(e) => {
								e.stopPropagation();
								goToNext();
							}}
							className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300 z-50"
							aria-label="Sonraki fotoğraf"
						>
							<IconChevronRight size={28} />
						</motion.button>

						{/* Photo Counter */}
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.5 }}
							className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/20 backdrop-blur-sm rounded-full text-white text-sm z-50"
						>
							{currentIndex + 1} / {getFilteredItems.length}
						</motion.div>
					</>
				)}

				{/* Info Icon */}
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: 0.5 }}
					className="absolute bottom-4 left-4 w-10 h-10 bg-gray-200 text-gray-700 backdrop-blur-sm z-50 rounded-full flex items-center justify-center cursor-pointer"
					onClick={toggleInfo}
				>
					<IconInfoCircle className={isInfoVisible ? "" : "animate-ping-custom"} />
				</motion.div>

				{/* Info Panel */}
				<AnimatePresence>
					{isInfoVisible && (
						<motion.div
							initial={{ opacity: 0, y: 20, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{
								opacity: 0,
								scale: 0.1,
								x: 20,
								y: 20,
								transition: { duration: 0.3 },
							}}
							transition={{ duration: 0.3 }}
							className="absolute bottom-8 left-0 w-full p-8 flex items-end"
							style={{ transformOrigin: "left bottom" }}
						>
							<div className="max-w-lg text-black bg-white/50 p-6 rounded-xl backdrop-blur-md">
								<motion.h2
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.1 }}
									className="font-bold mb-2"
									style={{
										fontSize: "clamp(1rem, 6vw, 2.25rem)",
									}}
								>
									{photo.title}
								</motion.h2>
								{photo.description && (
									<motion.p
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.15 }}
										className="mb-4 max-w-lg text-gray-500"
									>
										{photo.description}
									</motion.p>
								)}
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2 }}
									className="flex flex-wrap gap-8"
								>
									<div>
										<span className="uppercase text-gray-600 text-sm">PHOTOGRAPHER</span>
										<p>{photo.photographer.title}</p>
									</div>
									{photo.client && (
										<div>
											<span className="uppercase text-gray-600 text-sm">CLIENT</span>
											<p>{photo.client}</p>
										</div>
									)}
									{photo.year && (
										<div>
											<span className="uppercase text-gray-600 text-sm">YEAR</span>
											<p>{photo.year}</p>
										</div>
									)}
									{photo.location && (
										<div>
											<span className="uppercase text-gray-600 text-sm">LOCATION</span>
											<p>{photo.location}</p>
										</div>
									)}
								</motion.div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Close Button */}
				<motion.button
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3 }}
					onClick={onClose}
					className="absolute top-0 right-0 text-black/60 hover:text-black transition-colors p-8 cursor-pointer"
				>
					<IconX className="w-6 h-6" />
				</motion.button>
			</motion.div>
		</>,
		document.body,
	);
}
