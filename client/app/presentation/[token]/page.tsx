"use client";

import { useEffect, useState, useMemo, use } from "react";
import { getApiUrl } from "@/lib/utils";
import SplashScreen from "@/components/presentation/SplashScreen";
import PresentationHeader from "@/components/presentation/PresentationHeader";
import AutoPresentation from "@/components/presentation/AutoPresentation";
import ClassicPresentation from "@/components/presentation/ClassicPresentation";
import type { PresentationData, PlayableItem } from "@/components/presentation/types";

export default function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
	const { token } = use(params);
	const [data, setData] = useState<PresentationData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [splashDone, setSplashDone] = useState(false);
	const [mode, setMode] = useState<"auto" | "classic">("auto");
	const [autoIndex, setAutoIndex] = useState(0);
	const [isComplete, setIsComplete] = useState(false);

	// Fetch presentation data
	useEffect(() => {
		if (!token) return;
		(async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/presentations/${encodeURIComponent(token)}`, {
					cache: "no-store",
				});
				if (!res.ok) {
					if (res.status === 404) {
						setError("Presentation not found or has expired.");
					} else {
						setError("Failed to load presentation.");
					}
					setLoading(false);
					return;
				}
				const json = await res.json();
				setData(json);

				// Default mode based on autoPlayEnabled
				if (!json.autoPlayEnabled) {
					setMode("classic");
				}
			} catch {
				setError("Failed to load presentation.");
			} finally {
				setLoading(false);
			}
		})();
	}, [token]);

	// Flatten sections into a sequential playlist for auto mode
	const playlist = useMemo<PlayableItem[]>(() => {
		if (!data) return [];
		const items: PlayableItem[] = [];
		data.sections.forEach((section, sIdx) => {
			section.items.forEach((item, iIdx) => {
				items.push({
					sectionIndex: sIdx,
					itemIndex: iIdx,
					sectionTitle: section.title,
					item,
				});
			});
		});
		return items;
	}, [data]);

	// Lock scroll for auto mode
	useEffect(() => {
		if (mode === "auto" && splashDone) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mode, splashDone]);

	// Loading state
	if (loading) {
		return (
			<div className="fixed inset-0 bg-black flex items-center justify-center">
				<div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
			</div>
		);
	}

	// Error state
	if (error || !data) {
		return (
			<div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
				<span className="text-white text-lg uppercase tracking-[4px] mb-4">Platz</span>
				<p className="text-white/60 text-md font-light">{error || "Presentation not found."}</p>
			</div>
		);
	}

	// Show splash screen first
	if (!splashDone && (data.clientName || data.clientNote)) {
		return (
			<SplashScreen clientName={data.clientName} clientNote={data.clientNote} onComplete={() => setSplashDone(true)} />
		);
	}

	return (
		<div className="min-h-screen bg-black">
			{/* Header */}
			<PresentationHeader
				clientName={data.clientName}
				currentIndex={autoIndex}
				totalItems={playlist.length}
				mode={mode}
				onToggleMode={() => {
					setMode((m) => (m === "auto" ? "classic" : "auto"));
				}}
			/>

			{/* Content */}
			{mode === "auto" && playlist.length > 0 ? (
				isComplete ? (
					<div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-40">
						<svg
							width="120"
							height="40"
							viewBox="0 0 120 40"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="mb-8"
						>
							<text x="0" y="32" fill="white" fontSize="32" fontFamily="Work Sans" fontWeight="300" letterSpacing="8">
								Platz
							</text>
						</svg>
						<p className="text-white/50 text-xs uppercase tracking-[4px] mb-8">PRESENTATION COMPLETE</p>
						<div className="flex items-center gap-6">
							<button
								onClick={() => {
									setAutoIndex(0);
									setIsComplete(false);
								}}
								className="text-white/60 hover:text-white text-xs uppercase tracking-[2px] border border-white/20 hover:border-white/40 px-6 py-3 transition-colors duration-300"
							>
								WATCH AGAIN
							</button>
							<a
								href="/"
								className="text-white/60 hover:text-white text-xs uppercase tracking-[2px] border border-white/20 hover:border-white/40 px-6 py-3 transition-colors duration-300"
							>
								VISIT WEBSITE
							</a>
						</div>
					</div>
				) : (
					<AutoPresentation
						data={data}
						playlist={playlist}
						currentIndex={autoIndex}
						onIndexChange={(i) => {
							setIsComplete(false);
							setAutoIndex(i);
						}}
						onComplete={() => setIsComplete(true)}
					/>
				)
			) : (
				<ClassicPresentation data={data} />
			)}
		</div>
	);
}
