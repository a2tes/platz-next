"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";

// Lazy load components
const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), {
	ssr: false,
});
const MouseTrail = dynamic(() => import("@/components/MouseTrail"), {
	ssr: false,
});

export default function Home() {
	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="light" fixed />
			<div className="hero-container">
				<div className="viewport">
					<div className="scroller" id="scroller"></div>
				</div>
			</div>
			<div className="background" id="background"></div>
		</>
	);
}
