"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import MouseTrail from "@/components/MouseTrail";
import EditorContent from "@/components/EditorContent";
import { getApiUrl } from "@/lib/utils";
import PageFooter from "@/components/PageFooter";

export default function About() {
	const [contentBlocks, setContentBlocks] = useState<any>(null);
	const [title, setTitle] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [isNotFound, setIsNotFound] = useState(false);

	useEffect(() => {
		const fetchAbout = async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/pages/about`);
				if (res.status === 404) {
					setIsNotFound(true);
					return;
				}
				if (!res.ok) throw new Error("Failed to fetch about page");
				const data = await res.json();

				if (data && data.contentBlocks) {
					setContentBlocks(data.contentBlocks);
					if (data.title) {
						setTitle(data.title);
					}
				}
			} catch (error) {
				console.error("Error fetching about content:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchAbout();
	}, []);

	if (isNotFound) {
		notFound();
	}

	if (isLoading) {
		return (
			<>
				<Navbar theme="dark" />
				<div className="h-screen flex items-center justify-center bg-black text-white">Loading...</div>
			</>
		);
	}

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="dark" />
			<PageFooter />

			<div className="content">
				<div className="relative mx-8">
					<h1 className="font-extrabold text-center pb-8" style={{ fontSize: "clamp(2rem, 10vw, 6rem)" }}>
						{title}
					</h1>
				</div>{" "}
				<div className="w-full max-w-3xl mx-4">
					<div className="leading-relaxed space-y-4 mb-20">
						{contentBlocks && (
							// Support both Quill format (object with html) and legacy EditorJS format (array of blocks)
							<EditorContent data={contentBlocks.format === "quill" ? contentBlocks : { blocks: contentBlocks }} />
						)}
					</div>
				</div>
			</div>
		</>
	);
}
