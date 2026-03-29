"use client";

import { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
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

interface DirectorItem {
	text: string;
	video: string;
	route: string;
}

export default function Home() {
	const [items, setItems] = useState<DirectorItem[]>([]);
	const [loading, setLoading] = useState(true);
	const activeVideoIndexRef = useRef<number>(0); // Track which video should be active

	// Fetch directors from API
	useEffect(() => {
		const fetchDirectors = async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/homepage/directors`, {
					cache: "no-store",
				});

				if (res.ok) {
					const data = await res.json();
					// Sort by sortOrder to ensure correct order, then map to items
					const sortedItems = [...(data.items || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
					const directorsData = sortedItems.map((item: any) => ({
						text: item.director?.title || "Unknown",
						// Use 720p MP4 for homepage instead of HLS for faster loading
						video: item.videoUrl720p || item.videoUrl || "/videos/placeholder.mp4",
						route: `/directors/${item.director?.slug || ""}`,
					}));
					setItems(directorsData);
				} else {
					console.error("Failed to fetch directors");
					setItems([]);
				}
			} catch (error) {
				console.error("Error fetching directors:", error);
				setItems([]);
			} finally {
				setLoading(false);
			}
		};

		fetchDirectors();
	}, []);

	useEffect(() => {
		if (loading || items.length === 0) return;

		// iOS Safari scroll lock
		document.body.classList.add("ios-scroll-lock");
		document.documentElement.classList.add("ios-scroll-lock");

		let currentIndex = 0;
		const heroContainer = document.querySelector(".hero-container") as HTMLAnchorElement;
		const scroller = document.getElementById("scroller");
		const background = document.getElementById("background");
		let busy = false;
		const videos: (HTMLVideoElement | null)[] = [];
		let currentVideo: HTMLVideoElement | null = null;
		const videoDisplays = 1;
		const displayOffset = Math.floor(videoDisplays / 2);
		let isAnimating = false;
		let autoplayEnabled = true;

		if (!scroller || !background || !heroContainer) return;

		function initializeVideos() {
			items.forEach((item, index) => {
				if (item.video) {
					const video = document.createElement("video");
					video.muted = true;
					video.playsInline = true;
					video.autoplay = false;
					video.classList.add("background-video");
					video.preload = "none"; // Don't preload any video initially

					// Store video URL for lazy loading
					video.dataset.src = item.video;
					video.dataset.index = String(index);

					video.onloadedmetadata = function () {
						video.dataset.duration = video.duration.toFixed(2);
					};

					video.setAttribute("webkit-playsinline", "true");
					video.setAttribute("playsinline", "true");

					video.addEventListener("error", (e) => {
						console.error(`Video ${index} yüklenemedi:`, e, "Src:", video.src);
						if (video.parentNode) {
							video.parentNode.removeChild(video);
						}
						videos[index] = null;

						// If this was the active video, skip to next
						if (video === currentVideo || activeVideoIndexRef.current === index) {
							setTimeout(() => {
								if (!busy) {
									scrollTo(1);
								}
							}, 100);
						}
					});

					video.addEventListener("loadeddata", () => {
						if (video === currentVideo && video.classList.contains("active") && video.paused) {
							tryPlayVideo(video);
						}
					});

					if (index === 0) {
						video.classList.add("active");
						currentVideo = video;
						// Only load the first video immediately
						video.src = item.video;
						video.preload = "auto";
						activeVideoIndexRef.current = 0;
					}

					if (background) background.appendChild(video);
					videos[index] = video;
				}
			});

			enableVideoPlayback();
		}

		function tryPlayVideo(video: HTMLVideoElement) {
			if (video) {
				// Eğer zaten oynatılıyorsa tekrar oynatma
				if (!video.paused) return;
				video.currentTime = 0; // Videoyu baştan başlat
				video.play();
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
			// Update the active index ref
			activeVideoIndexRef.current = index;

			// Unload all videos except current and next
			const nextIndex = (index + 1) % items.length;
			videos.forEach((video, i) => {
				if (video && i !== index && i !== nextIndex) {
					// Stop and unload video to cancel download
					video.pause();
					video.removeAttribute("src");
					video.load(); // This cancels the download
				}
			});

			if (currentVideo) {
				currentVideo.classList.remove("active");
				if (!currentVideo.paused) {
					currentVideo.pause();
					currentVideo.currentTime = 0;
				}
			}

			if (videos[index]) {
				heroContainer.href = items[index].route;
				currentVideo = videos[index];

				// Load video if not loaded yet
				if (!currentVideo!.src && currentVideo!.dataset.src) {
					currentVideo!.src = currentVideo!.dataset.src;
					currentVideo!.preload = "auto";
				}

				// Preload next video (but don't play it)
				if (videos[nextIndex] && !videos[nextIndex]!.src && videos[nextIndex]!.dataset.src) {
					videos[nextIndex]!.src = videos[nextIndex]!.dataset.src;
					videos[nextIndex]!.preload = "auto";
				}

				currentVideo!.classList.add("active");

				// Video hazırsa hemen oynat, değilse event'i bekle
				if (currentVideo!.readyState >= 2) {
					// HAVE_CURRENT_DATA or better
					tryPlayVideo(currentVideo!);
				} else {
					// Tek bir listener ekle - bir kere tetiklenmesi için
					let loadingTimedOut = false;
					const videoToLoad = currentVideo!;

					// Timeout: if video doesn't load in 3 seconds, skip to next
					const loadTimeout = setTimeout(() => {
						if (videoToLoad === currentVideo && videoToLoad.readyState < 2) {
							loadingTimedOut = true;
							console.warn(`Video ${index} yüklenemedi (timeout), sonraki videoya geçiliyor`);
							if (!busy) {
								scrollTo(1);
							}
						}
					}, 1000);

					const onLoadedData = () => {
						clearTimeout(loadTimeout);
						if (!loadingTimedOut && currentVideo && currentVideo.classList.contains("active")) {
							tryPlayVideo(currentVideo);
						}
						if (currentVideo) {
							currentVideo.removeEventListener("loadeddata", onLoadedData);
						}
					};
					currentVideo!.addEventListener("loadeddata", onLoadedData, {
						once: true,
					});
				}
			}

			if (background) background.style.backgroundColor = "black";
		}

		function getRelativeIndex(offset: number) {
			return (currentIndex + offset + items.length) % items.length;
		}

		function renderInitial() {
			scroller.innerHTML = "";
			for (let i = displayOffset * -1; i <= displayOffset; i++) {
				const item = createItem(items[getRelativeIndex(i)], i === 0);
				scroller.appendChild(item);
			}
			switchVideo(currentIndex);
			gsap.set(scroller, { y: 0 });
		}

		function createItem(item: (typeof items)[0], isActive = false) {
			const a = document.createElement("a");
			a.classList.add("item");
			a.href = item.route;
			if (isActive) {
				a.classList.add("active");
			}
			a.textContent = ""; // Yönetmen adını gizle (item.text)
			return a;
		}

		function scrollTo(direction: number) {
			if (busy) return;
			busy = true;

			currentIndex = (currentIndex + direction + items.length) % items.length;

			if (direction > 0) {
				const newItemIndex = getRelativeIndex(displayOffset);
				const newItem = createItem(items[newItemIndex], false);
				scroller.appendChild(newItem);

				gsap.to(scroller, {
					y: "-6rem",
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
				const newItemIndex = getRelativeIndex(-displayOffset);
				const newItem = createItem(items[newItemIndex], false);

				scroller.insertBefore(newItem, scroller.firstChild);
				gsap.set(scroller, { y: "-6rem" });

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
				el.classList.toggle("active", i === displayOffset);
			});
		}

		function changeDirection(direction: number) {
			disableAutoplay();
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

		// Video ended handler - switch to next video when current one finishes
		let pendingTransition = false;
		function handleVideoEnded(e: Event) {
			const video = e.target as HTMLVideoElement;
			if (autoplayEnabled && !busy && !pendingTransition && video === currentVideo) {
				pendingTransition = true;
				prepareAndSwitchToNext();
			}
		}

		function prepareAndSwitchToNext() {
			const nextIndex = (currentIndex + 1) % items.length;
			const nextVideo = videos[nextIndex];

			if (!nextVideo) {
				// No next video, just scroll
				pendingTransition = false;
				scrollTo(1);
				return;
			}

			// Load next video if not loaded
			if (!nextVideo.src && nextVideo.dataset.src) {
				nextVideo.src = nextVideo.dataset.src;
				nextVideo.preload = "auto";
			}

			// If next video is ready to play, switch immediately
			if (nextVideo.readyState >= 3) {
				// HAVE_FUTURE_DATA or better
				pendingTransition = false;
				scrollTo(1);
				return;
			}

			// Wait for next video to be ready, with timeout
			let switched = false;
			const switchTimeout = setTimeout(() => {
				if (!switched) {
					switched = true;
					pendingTransition = false;
					scrollTo(1);
				}
			}, 3000);

			const onCanPlay = () => {
				if (!switched) {
					switched = true;
					clearTimeout(switchTimeout);
					pendingTransition = false;
					scrollTo(1);
				}
				nextVideo.removeEventListener("canplay", onCanPlay);
			};

			nextVideo.addEventListener("canplay", onCanPlay, { once: true });
		}

		function disableAutoplay() {
			autoplayEnabled = false;
		}

		window.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("touchstart", handleTouchStart, { passive: false });
		window.addEventListener("touchmove", handleTouchMove, { passive: false });
		window.addEventListener("touchend", handleTouchEnd, { passive: false });
		window.addEventListener("keydown", handleKeyDown);

		["wheel", "touchstart", "keydown"].forEach((evt) => window.addEventListener(evt, disableAutoplay, { once: true }));

		initializeVideos();

		// Add ended listener to all videos for autoplay
		videos.forEach((video) => {
			if (video) {
				video.addEventListener("ended", handleVideoEnded);
			}
		});

		renderInitial();

		// İlk video oynatmayı başlat - DOM'a eklendikten sonra
		setTimeout(() => {
			if (currentVideo && currentVideo.classList.contains("active")) {
				if (currentVideo.readyState >= 2) {
					tryPlayVideo(currentVideo);
				}
			}
		}, 100);

		return () => {
			// iOS scroll lock'u kaldır
			document.body.classList.remove("ios-scroll-lock");
			document.documentElement.classList.remove("ios-scroll-lock");

			// Remove ended listeners
			videos.forEach((video) => {
				if (video) {
					video.removeEventListener("ended", handleVideoEnded);
				}
			});

			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener("touchstart", handleTouchStart);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [items]);

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="light" fixed />
			<DropdownMenu />
			<a className="hero-container">
				<div className="viewport">
					<div className="scroller" id="scroller"></div>
				</div>
			</a>
			<div className="background" id="background"></div>

			{/* Scroll/Swipe Hint */}
			<div className="scroll-hint">
				<div className="scroll-hint-arrows">
					<svg
						className="scroll-hint-arrow up"
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
						<path d="m18 15-6-6-6 6" />
					</svg>
					<svg
						className="scroll-hint-arrow down"
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
						<path d="m6 9 6 6 6-6" />
					</svg>
				</div>
			</div>
		</>
	);
}
