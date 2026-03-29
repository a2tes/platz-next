"use client";

import { motion } from "motion/react";
import type { PlayableItem } from "./types";

interface PresentationHeaderProps {
	clientName: string | null;
	currentIndex: number;
	totalItems: number;
	mode: "auto" | "classic";
	onToggleMode: () => void;
}

export default function PresentationHeader({
	clientName,
	currentIndex,
	totalItems,
	mode,
	onToggleMode,
}: PresentationHeaderProps) {
	const progress = totalItems > 0 ? ((currentIndex + 1) / totalItems) * 100 : 0;

	return (
		<header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
			{/* Progress bar */}
			<div className="h-[2px] bg-white/10 w-full">
				<motion.div
					className="h-full bg-white/60"
					initial={{ width: 0 }}
					animate={{ width: `${progress}%` }}
					transition={{ duration: 0.5, ease: "easeOut" }}
				/>
			</div>

			{/* Header content */}
			<div className="flex items-center justify-between px-6 py-4 pointer-events-auto">
				{/* Logo */}
				<div className="flex items-center gap-4">
					<span className="text-white text-md font-light tracking-[4px] uppercase">Platz</span>
					{clientName && (
						<>
							<span className="text-white/20">|</span>
							<span className="text-white/50 text-md font-light tracking-wide">{clientName}</span>
						</>
					)}
				</div>

				{/* Controls */}
				<div className="flex items-center gap-4">
					{/* Item counter */}
					{mode === "auto" && totalItems > 0 && (
						<span className="text-white/40 text-sm font-light tabular-nums">
							{currentIndex + 1} / {totalItems}
						</span>
					)}

					{/* Mode toggle */}
					<button
						onClick={onToggleMode}
						className="text-white/50 hover:text-white text-sm uppercase tracking-[2px] transition-colors duration-300 cursor-pointer"
					>
						{mode === "auto" ? "CLASSIC" : "AUTO"}
					</button>

					{/* Website link */}
					<a
						href="/"
						className="text-white/30 hover:text-white/60 transition-colors duration-300"
						title="Visit Website"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
							<polyline points="15 3 21 3 21 9" />
							<line x1="10" y1="14" x2="21" y2="3" />
						</svg>
					</a>
				</div>
			</div>
		</header>
	);
}
