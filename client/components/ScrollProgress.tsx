'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';

export default function ScrollProgress() {
	useEffect(() => {
		const progressBar = document.querySelector('#scroll-progress') as HTMLElement;
		const scrollbarMap = document.querySelector('#scrollbar-map') as HTMLElement;
		let scrollTimer: NodeJS.Timeout;

		if (!scrollbarMap || !progressBar) return;

		function updateProgressHeight() {
			const windowHeight = window.innerHeight;
			const documentHeight = document.documentElement.scrollHeight;

			if (documentHeight <= windowHeight) {
				scrollbarMap.style.display = 'none';
				return;
			}

			const progressHeight = (windowHeight / documentHeight) * scrollbarMap.offsetHeight;
			progressBar.style.height = `${progressHeight}px`;
		}

		function toggleScrollbarVisibility(show: boolean) {
			gsap.to(scrollbarMap, {
				opacity: show ? 1 : 0,
				x: show ? 0 : 20,
				duration: 0.3,
				ease: 'power2.inOut'
			});
		}

		function handleScrollActivity() {
			clearTimeout(scrollTimer);
			toggleScrollbarVisibility(true);

			scrollTimer = setTimeout(() => {
				toggleScrollbarVisibility(false);
			}, 2000);
		}

		function updateProgress() {
			const windowHeight = window.innerHeight;
			const documentHeight = document.documentElement.scrollHeight - windowHeight;
			const scrolled = window.scrollY;

			const maxTranslate = scrollbarMap.offsetHeight - progressBar.offsetHeight;
			const translateY = (scrolled / documentHeight) * maxTranslate;

			progressBar.style.transform = `translateY(${translateY}px)`;
		}

		gsap.set(scrollbarMap, {
			opacity: 0,
			x: 20
		});

		updateProgressHeight();
		updateProgress();
		handleScrollActivity();

		const handleScroll = () => {
			updateProgress();
			handleScrollActivity();
		};

		const handleResize = () => {
			updateProgressHeight();
			updateProgress();
			handleScrollActivity();
		};

		window.addEventListener('scroll', handleScroll);
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', handleResize);
			clearTimeout(scrollTimer);
		};
	}, []);

	return (
		<div id="scrollbar-map">
			<div id="scroll-progress"></div>
		</div>
	);
}
