"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import Navbar from "@/components/Navbar";
import WorkModal from "@/components/works/WorkModal";
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

interface Work {
	title: string;
	slug: string;
	client: string;
	shortDescription: string;
	subtitle?: string;
	caseStudy?: string;
	directors?: Array<{ title: string; slug?: string }>;
	videoUrl: string;
	videoThumbnailUrl: string;
	images: {
		thumbnail?: string;
		small?: string;
		medium?: string;
		large?: string;
		original?: string;
	} | null;
}

export interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

export default function Works() {
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [selectedWork, setSelectedWork] = useState<Work | null>(null);
	const [selectedCardRect, setSelectedCardRect] = useState<CardRect | null>(null);
	const observerTarget = useRef<HTMLDivElement>(null);

	const LIMIT = 5;

	// Fetch blocks when page changes
	useEffect(() => {
		const fetchBlocks = async () => {
			setLoading(true);
			try {
				const result = await getBlockPage("WORKS", { page, limit: LIMIT });
				if (result) {
					// Check if we have more pages
					if (result.pagination.page >= result.pagination.totalPages) {
						setHasMore(false);
					}
					// Append new blocks to existing ones
					setBlocks((prev) => {
						// Filter out duplicates by block id
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
		setSelectedWork(null);
		setSelectedCardRect(null);
	};

	// Handle work click from block - work data is already in the item
	const handleBlockWorkClick = (item: BlockContentItem, rect?: CardRect) => {
		if (!item.work) return;

		// Convert BlockWork to Work format
		const work: Work = {
			title: item.work.title,
			slug: item.work.slug,
			client: item.work.client,

			shortDescription: item.work.shortDescription,
			subtitle: item.work.subtitle,
			caseStudy: item.work.caseStudy,
			directors: item.work.directors,
			videoUrl: item.work.videoUrl || "",
			videoThumbnailUrl: item.work.thumbnail || "",
			images: null,
		};

		setSelectedWork(work);
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
					<BlockRenderer blocks={blocks} onWorkClick={handleBlockWorkClick} />
				</section>
			)}

			{/* Intersection Observer Target for Infinite Scroll */}
			{hasMore && (
				<div ref={observerTarget} className="w-full py-8 flex justify-center">
					{loading && <div className="text-white text-sm animate-pulse">Loading more blocks...</div>}
				</div>
			)}

			<AnimatePresence>
				{selectedWork && <WorkModal work={selectedWork} cardRect={selectedCardRect} onClose={handleCloseModal} />}
			</AnimatePresence>
		</>
	);
}
