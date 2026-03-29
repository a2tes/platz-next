"use client";

import { useEffect } from "react";
import React from "react";
import { gsap } from "gsap";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/utils";

// Lazy load components
const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), {
	ssr: false,
});
const MouseTrail = dynamic(() => import("@/components/MouseTrail"), {
	ssr: false,
});
const DropdownMenu = dynamic(() => import("@/components/DropdownMenu"), {
	ssr: false,
});

type DirectorItem = {
	text: string;
	video: string | null;
	route: string;
	slug: string;
};

// API'den veri çekeceğiz, başlangıçta boş
// route şu an '/director' sayfasına gidiyor; slug bazlı route ileride eklenebilir
// (şimdilik tasarım aynı davranışı korusun)

function DirectorsContent() {
	const [items, setItems] = React.useState<DirectorItem[]>([]);
	const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");
	const [isTransitioning, setIsTransitioning] = React.useState(false);
	const router = useRouter();

	// Public API'den directors listesini çek
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/directors-page/selections`, {
					cache: "no-store",
				});
				if (!res.ok) throw new Error(`Failed to load directors: ${res.status}`);
				const data = await res.json();

				const items = data?.items || [];
				const mapped: DirectorItem[] = items.map((item: any) => ({
					text: item.director?.title || "Unknown",
					video: item.videoUrl720p || item.videoUrl || null,
					route: `/directors/${item.director?.slug || ""}`,
					slug: item.director?.slug || "",
				}));

				if (!cancelled) setItems(mapped);
			} catch (err) {
				console.error("Directors fetch error", err);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleViewModeChange = (newMode: "list" | "grid") => {
		if (isTransitioning || viewMode === newMode) return;

		setIsTransitioning(true);
		const container = document.querySelector(".director-container");

		// Fade out
		gsap.to(container, {
			opacity: 0,
			duration: 0.3,
			ease: "power2.inOut",
			onComplete: () => {
				setViewMode(newMode);
				// Fade in after mode change
				setTimeout(() => {
					gsap.to(container, {
						opacity: 1,
						duration: 0.3,
						ease: "power2.inOut",
						onComplete: () => {
							setIsTransitioning(false);
						},
					});
				}, 50);
			},
		});
	};

	useEffect(() => {
		if (!items || items.length === 0) return; // veri gelmeden init etme
		const background = document.getElementById("background");
		const scroller = document.getElementById("scroller");

		// Clean up videos and scroller when switching to grid mode
		if (viewMode === "grid") {
			if (background) {
				const videos = background.querySelectorAll("video");
				videos.forEach((video) => {
					video.pause();
					video.src = "";
					video.remove();
				});
			}
			if (scroller) {
				// Remove all items from scroller
				scroller.innerHTML = "";
				scroller.style.display = "none";
			}
			// Also clean up any stray items in viewport
			const viewport = document.querySelector(".viewport");
			if (viewport) {
				const strayItems = viewport.querySelectorAll(".item");
				strayItems.forEach((item) => {
					if (!item.closest(".grid")) {
						item.remove();
					}
				});
			}
			return;
		}

		// Show scroller in list mode
		if (scroller) {
			scroller.style.display = "";
		}

		// iOS Safari scroll lock
		document.body.classList.add("ios-scroll-lock");
		document.documentElement.classList.add("ios-scroll-lock");

		let currentIndex = 0;
		let busy = false;
		let videos: (HTMLVideoElement | null)[] = [];
		let currentVideo: HTMLVideoElement | null = null;
		const videoDisplays = 7;
		let isAnimating = false;

		if (!scroller || !background) return;

		// Helper function to preload next video after current is ready
		function preloadNextVideo(currentIdx: number) {
			const nextIdx = (currentIdx + 1) % items.length;
			const nextVideo = videos[nextIdx];
			if (nextVideo && !nextVideo.src && nextVideo.dataset.videoSrc) {
				nextVideo.src = nextVideo.dataset.videoSrc;
				nextVideo.preload = "auto";
				nextVideo.load();
			}
		}

		function initializeVideos() {
			items.forEach((item, index) => {
				if (item.video) {
					const video = document.createElement("video");
					video.muted = true;
					video.playsInline = true;
					video.classList.add("background-video");
					video.setAttribute("webkit-playsinline", "true");
					video.setAttribute("playsinline", "true");

					// Store video source
					video.dataset.videoSrc = item.video;
					video.dataset.index = String(index);

					// Only load first video immediately, others will be loaded after current is ready
					if (index === 0) {
						video.preload = "auto";
						video.src = item.video;
					} else {
						video.preload = "none";
					}

					video.addEventListener("loadedmetadata", function () {
						video.dataset.duration = video.duration.toFixed(2);
						video.dataset.ready = "true";
					});

					video.addEventListener("error", (e) => {
						console.warn(`Video ${index} loading error:`, e);
						video.dataset.ready = "false";
						// If this was the active video, skip to next
						if (video === currentVideo) {
							setTimeout(() => {
								if (!busy) {
									changeDirection(1);
								}
							}, 100);
						}
					});

					// When video is fully loaded (canplaythrough), preload next video
					video.addEventListener(
						"canplaythrough",
						() => {
							video.dataset.ready = "true";
							// If this is the active video, preload next
							if (video.classList.contains("active")) {
								preloadNextVideo(index);
							}
						},
						{ once: true },
					);

					video.addEventListener("loadeddata", () => {
						video.dataset.ready = "true";
					});

					// Auto advance to next director when video ends
					video.addEventListener("ended", () => {
						if (video.classList.contains("active")) {
							changeDirection(1);
						}
					});

					if (index === 0) {
						video.classList.add("active");
						currentVideo = video;
					}

					if (background) background.appendChild(video);
					videos[index] = video;
				}
			});

			enableVideoPlayback();
		}

		function tryPlayVideo(video: HTMLVideoElement) {
			if (!video) return;

			// If video has no metadata yet, wait for it
			if (video.readyState === 0) {
				const onReady = () => {
					video.removeEventListener("loadedmetadata", onReady);
					tryPlayVideo(video);
				};
				video.addEventListener("loadedmetadata", onReady);
				return;
			}

			// Try to play regardless of readyState (1, 2, 3, or 4)
			const playPromise = video.play();
			if (playPromise !== undefined) {
				playPromise.then().catch((e) => {
					// If readyState is low, wait for more data
					if (video.readyState < 3) {
						const onCanPlay = () => {
							video.removeEventListener("canplay", onCanPlay);
							tryPlayVideo(video);
						};
						video.addEventListener("canplay", onCanPlay);
					} else {
						// Retry after a short delay
						setTimeout(() => {
							if (video.classList.contains("active")) {
								tryPlayVideo(video);
							}
						}, 200);
					}
				});
			}
		}

		function enableVideoPlayback() {
			const enableVideos = () => {
				if (currentVideo && currentVideo.paused) {
					tryPlayVideo(currentVideo);
				}
				["click", "touchstart", "keydown"].forEach((evt) => {
					document.removeEventListener(evt, enableVideos);
				});
			};

			["click", "touchstart", "keydown"].forEach((evt) => {
				document.addEventListener(evt, enableVideos, { once: true });
			});
		}

		function switchVideo(index: number) {
			const nextIndex = (index + 1) % items.length;
			const prevIndex = (index - 1 + items.length) % items.length;

			// Unload videos that are not current, next, or previous to free memory
			videos.forEach((video, i) => {
				if (video && i !== index && i !== nextIndex && i !== prevIndex) {
					// Stop and unload video to cancel download
					video.pause();
					video.removeAttribute("src");
					video.load(); // This cancels the download
					video.dataset.ready = "false";
				}
			});

			if (currentVideo) {
				currentVideo.classList.remove("active");
				if (!currentVideo.paused) {
					currentVideo.pause();
				}
				currentVideo.currentTime = 0;
			}

			if (videos[index]) {
				currentVideo = videos[index];

				// Load video if not loaded yet
				if (!currentVideo!.src && currentVideo!.dataset.videoSrc) {
					currentVideo!.src = currentVideo!.dataset.videoSrc;
					currentVideo!.preload = "auto";
					currentVideo!.load();
				}

				currentVideo!.classList.add("active");

				// Reset video to beginning
				currentVideo!.currentTime = 0;

				// Force video to reload if it ended
				if (currentVideo!.ended) {
					currentVideo!.load();
				}

				// Video hazırsa hemen oynat ve sonraki videoyu yükle
				if (currentVideo!.readyState >= 4) {
					// HAVE_ENOUGH_DATA - fully loaded
					tryPlayVideo(currentVideo!);
					// Preload next and previous after current is ready
					preloadNextVideo(index);
					preloadPrevVideo(index);
				} else {
					const videoToLoad = currentVideo!;

					// Play as soon as we have some data
					const onLoadedData = () => {
						if (videoToLoad === currentVideo && videoToLoad.classList.contains("active")) {
							tryPlayVideo(videoToLoad);
						}
						videoToLoad.removeEventListener("loadeddata", onLoadedData);
					};
					currentVideo!.addEventListener("loadeddata", onLoadedData, { once: true });

					// Preload next/prev only after current video is fully loaded
					const onCanPlayThrough = () => {
						if (videoToLoad === currentVideo && videoToLoad.classList.contains("active")) {
							preloadNextVideo(index);
							preloadPrevVideo(index);
						}
						videoToLoad.removeEventListener("canplaythrough", onCanPlayThrough);
					};
					currentVideo!.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
				}
			}
		}

		// Helper function to preload previous video
		function preloadPrevVideo(currentIdx: number) {
			const prevIdx = (currentIdx - 1 + items.length) % items.length;
			const prevVideo = videos[prevIdx];
			if (prevVideo && !prevVideo.src && prevVideo.dataset.videoSrc) {
				prevVideo.src = prevVideo.dataset.videoSrc;
				prevVideo.preload = "auto";
				prevVideo.load();
			}
		}

		function getRelativeIndex(offset: number) {
			return (((currentIndex + offset) % items.length) + items.length) % items.length;
		}

		function renderInitial() {
			scroller.innerHTML = "";
			for (let i = Math.floor(videoDisplays / 2) * -1; i <= Math.floor(videoDisplays / 2); i++) {
				const item = createItem(items[getRelativeIndex(i)], i === 0);
				scroller.appendChild(item);
			}
			switchVideo(currentIndex);
			gsap.set(scroller, { y: 0 });
		}

		function createItem(item: (typeof items)[0], isActive = false) {
			const div = document.createElement("div");
			div.classList.add("item");
			div.dataset.route = item.route;
			div.style.cursor = "pointer";
			if (isActive) {
				div.classList.add("active");
			}
			div.textContent = item.text;
			div.addEventListener("click", () => {
				router.push(item.route);
			});
			return div;
		}

		function scrollTo(direction: number) {
			if (busy) return;
			busy = true;

			currentIndex = (currentIndex + direction + items.length) % items.length;

			if (direction > 0) {
				const newItemIndex = getRelativeIndex(Math.floor(videoDisplays / 2));
				const newItem = createItem(items[newItemIndex], false);
				scroller.appendChild(newItem);

				gsap.to(scroller, {
					y: "-4rem",
					duration: 0.4,
					ease: "power2.inOut",
					onComplete: () => {
						scroller.removeChild(scroller.firstChild!);
						gsap.set(scroller, { y: 0 });
						updateActiveItem();
						switchVideo(currentIndex);
						busy = false;
					},
				});
			} else {
				const newItemIndex = getRelativeIndex(Math.floor(videoDisplays / 2) * -1);
				const newItem = createItem(items[newItemIndex], false);

				scroller.insertBefore(newItem, scroller.firstChild);
				gsap.set(scroller, { y: "-4rem" });

				gsap.to(scroller, {
					y: 0,
					duration: 0.4,
					ease: "power2.inOut",
					onComplete: () => {
						scroller.removeChild(scroller.lastChild!);
						updateActiveItem();
						switchVideo(currentIndex);
						busy = false;
					},
				});
			}
		}

		function updateActiveItem() {
			scroller.querySelectorAll(".item").forEach((el, i) => {
				el.classList.toggle("active", i === Math.floor(videoDisplays / 2) + 1);
			});
		}

		function changeDirection(direction: number) {
			if (isAnimating) return;
			isAnimating = true;

			setTimeout(() => {
				isAnimating = false;
			}, 600);
			scrollTo(direction);
		}

		let scrollAccumulator = 0;
		const SCROLL_THRESHOLD = 500;

		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();

			if (isAnimating) return;

			scrollAccumulator += e.deltaY;

			if (Math.abs(scrollAccumulator) >= SCROLL_THRESHOLD) {
				isAnimating = true;
				const direction = scrollAccumulator > 0 ? 1 : -1;
				scrollTo(direction);
				scrollAccumulator = 0;

				setTimeout(() => {
					isAnimating = false;
				}, 600);
			}
		};

		let touchStartY: number | null = null;
		const handleTouchStart = (e: TouchEvent) => {
			touchStartY = e.touches[0].clientY;
		};

		const handleTouchMove = (e: TouchEvent) => {
			e.preventDefault(); // iOS Safari'de body scroll'u engelle
		};

		const handleTouchEnd = (e: TouchEvent) => {
			if (touchStartY === null) return;
			const touchEndY = e.changedTouches[0].clientY;
			const deltaY = touchStartY - touchEndY;
			if (Math.abs(deltaY) > 30) {
				e.preventDefault();
				scrollTo(deltaY > 0 ? 1 : -1);
			}
			touchStartY = null;
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
			}
			if (e.key === "ArrowDown") changeDirection(1);
			if (e.key === "ArrowUp") changeDirection(-1);
		};

		// Scroll button handlers
		const scrollUpBtn = document.getElementById("scrollUp");
		const scrollDownBtn = document.getElementById("scrollDown");

		if (scrollUpBtn) scrollUpBtn.addEventListener("click", () => changeDirection(-1));
		if (scrollDownBtn) scrollDownBtn.addEventListener("click", () => changeDirection(1));

		window.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("touchstart", handleTouchStart, { passive: false });
		window.addEventListener("touchmove", handleTouchMove, { passive: false });
		window.addEventListener("touchend", handleTouchEnd, { passive: false });
		window.addEventListener("keydown", handleKeyDown);

		initializeVideos();
		renderInitial();

		return () => {
			// iOS scroll lock'u kaldır
			document.body.classList.remove("ios-scroll-lock");
			document.documentElement.classList.remove("ios-scroll-lock");

			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener("touchstart", handleTouchStart);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
			window.removeEventListener("keydown", handleKeyDown);

			// Clean up videos on unmount
			if (background) {
				const videos = background.querySelectorAll("video");
				videos.forEach((video) => {
					video.pause();
					video.src = "";
					video.remove();
				});
			}
		};
	}, [viewMode, items]);

	if (viewMode === "grid") {
		const sortedItems = [...items].sort((a, b) => a.text.localeCompare(b.text));

		return (
			<>
				<ScrollProgress />
				<MouseTrail />
				<Navbar theme="dark" />
				<DropdownMenu />

				<div className="directors-grid">
					<div className="director-container flex flex-col">
						<div className="relative mx-8">
							<h1
								className="font-extrabold text-center py-8 tracking-widest"
								style={{ fontSize: "clamp(2rem, 10vw, 6rem)" }}
							>
								Directors
							</h1>
						</div>
						<div className="viewport">
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 sm:gap-x-12 lg:gap-x-16 gap-y-2 px-4 sm:px-8 pb-8">
								{sortedItems.map((item) => (
									<Link
										key={item.text}
										href={item.route}
										className="item text-base lg:text-xl text-center hover:opacity-70 transition-opacity"
									>
										{item.text}
									</Link>
								))}
							</div>
						</div>
					</div>

					{/* No background div in grid mode */}

					<div className="bottom-buttons">
						<button
							className="bottom-buttons-group bottom-buttons-group-dark"
							onClick={() => handleViewModeChange("list")}
							disabled={isTransitioning}
						>
							Show as list
						</button>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="light" fixed />
			<DropdownMenu />

			<div className="directors-list">
				<div className="director-container">
					<div className="viewport">
						<div className="scroller" id="scroller"></div>
					</div>
				</div>
				<div className="background" id="background">
					<div className="background-overlay"></div>
				</div>
				<div className="bottom-buttons">
					<button
						className="bottom-buttons-group bottom-buttons-group-light whitespace-nowrap"
						onClick={() => handleViewModeChange("grid")}
						disabled={isTransitioning}
					>
						Show as grid
					</button>
					<div id="scrollDirection" className="bottom-buttons-group bottom-buttons-group-light">
						<button id="scrollUp" className="hover:scale-110 transition-transform">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m18 15-6-6-6 6" />
							</svg>
						</button>
						<button id="scrollDown" className="hover:scale-110 transition-transform">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

export default function Directors() {
	return <DirectorsContent />;
}
