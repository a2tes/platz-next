"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import Navbar from "@/components/Navbar";
import AnimationModal from "@/components/animations/AnimationModal";
import { BlockRenderer } from "@/components/blocks";
import { getBlockPage, Block, BlockContentItem } from "@/lib/blocks";

const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), {
	ssr: false,
});
const MouseTrail = dynamic(() => import("@/components/MouseTrail"), {
	ssr: false,
});
const DropdownMenu = dynamic(() => import("@/components/DropdownMenu"), {
	ssr: false,
});

interface Animation {
	title: string;
	slug: string;
	client: string;
	shortDescription: string;
	videoUrl: string;
	videoThumbnailUrl: string;
}

export interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

export default function Animations() {
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
	const [selectedCardRect, setSelectedCardRect] = useState<CardRect | null>(null);
	const observerTarget = useRef<HTMLDivElement>(null);

	const LIMIT = 5;

	// Fetch blocks when page changes
	useEffect(() => {
		const fetchBlocks = async () => {
			setLoading(true);
			try {
				const result = await getBlockPage("ANIMATIONS", { page, limit: LIMIT });
				if (result) {
					if (result.pagination.page >= result.pagination.totalPages) {
						setHasMore(false);
					}
					setBlocks((prev) => {
						const newBlocks = result.blocks.filter((newBlock) => !prev.some((b) => b.id === newBlock.id));
						return [...prev, ...newBlocks];
					});
				} else {
					setHasMore(false);
				}
			} catch (error) {
				console.error("Failed to fetch blocks", error);
			} finally {
				setLoading(false);
			}
		};
		fetchBlocks();
	}, [page]);

	// Intersection observer for infinite scroll
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					setPage((prev) => prev + 1);
				}
			},
			{ threshold: 0.1 },
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => {
			if (observerTarget.current) {
				observer.unobserve(observerTarget.current);
			}
		};
	}, [hasMore, loading]);

	const handleCloseModal = () => {
		setSelectedAnimation(null);
		setSelectedCardRect(null);
	};

	// Handle animation click from block
	const handleBlockItemClick = (item: BlockContentItem, rect?: CardRect) => {
		if (!item.animation) return;

		const animation: Animation = {
			title: item.animation.title,
			slug: item.animation.slug,
			client: item.animation.client,

			shortDescription: item.animation.shortDescription || "",
			videoUrl: item.animation.videoUrl || "",
			videoThumbnailUrl: item.animation.thumbnail || "",
		};

		setSelectedAnimation(animation);
		setSelectedCardRect(rect || null);
	};

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="dark" />
			<DropdownMenu />

			{/* Block Layout Section */}
			{blocks.length > 0 && (
				<section className="w-full">
					<BlockRenderer blocks={blocks} onItemClick={handleBlockItemClick} />
				</section>
			)}

			{/* Intersection Observer Target for Infinite Scroll */}
			{hasMore && (
				<div ref={observerTarget} className="w-full py-8 flex justify-center">
					{loading && <div className="text-white text-sm animate-pulse">Loading more blocks...</div>}
				</div>
			)}

			<AnimatePresence>
				{selectedAnimation && (
					<AnimationModal animation={selectedAnimation} cardRect={selectedCardRect} onClose={handleCloseModal} />
				)}
			</AnimatePresence>
		</>
	);
}
