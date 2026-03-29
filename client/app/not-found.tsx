"use client";

import Link from "next/link";
import { useEffect } from "react";
import { gsap } from "gsap";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";

const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), {
	ssr: false,
});
const MouseTrail = dynamic(() => import("@/components/MouseTrail"), {
	ssr: false,
});
const DropdownMenu = dynamic(() => import("@/components/DropdownMenu"), {
	ssr: false,
});

export default function NotFound() {
	useEffect(() => {
		// Animate the 404 text
		gsap.from("#notFoundText", {
			opacity: 0,
			y: 50,
			duration: 0.8,
			ease: "power2.out",
		});

		gsap.from("#notFoundSubtext", {
			opacity: 0,
			y: 30,
			duration: 0.8,
			delay: 0.2,
			ease: "power2.out",
		});

		gsap.from("#notFoundButton", {
			opacity: 0,
			y: 20,
			duration: 0.8,
			delay: 0.4,
			ease: "power2.out",
		});

		gsap.from("#notFoundDecorative", {
			opacity: 0,
			y: 20,
			duration: 0.8,
			delay: 0.6,
			ease: "power2.out",
		});
	}, []);

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="light" fixed />
			<DropdownMenu />

			<main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
				<div className="max-w-2xl mx-auto text-center">
					{/* 404 Text */}
					<div id="notFoundText" className="mb-8">
						<h1 className="text-9xl md:text-[150px] font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-400 to-gray-600 leading-none">
							404
						</h1>
					</div>

					{/* Subtext */}
					<div id="notFoundSubtext" className="mb-12">
						<h2 className="text-3xl md:text-4xl font-bold mb-4">
							Page Not Found
						</h2>
						<p className="text-gray-400 text-lg">
							The page you're looking for doesn't exist or has been moved.
						</p>
					</div>

					{/* Action Buttons */}
					<div
						id="notFoundButton"
						className="flex flex-col sm:flex-row gap-4 justify-center"
					>
						<Link
							href="/"
							className="px-8 py-3 border border-white text-white font-semibold rounded-2xl hover:bg-white/10 transition-colors duration-300"
						>
							Go Home
						</Link>
					</div>

					{/* Decorative element */}
					<div
						id="notFoundDecorative"
						className="mt-16 pt-8 border-t border-gray-800 max-w-fit mx-auto"
					>
						<p className="text-gray-500 text-sm">
							If you believe this is a mistake, please contact support.
						</p>
					</div>
				</div>
			</main>
		</>
	);
}
