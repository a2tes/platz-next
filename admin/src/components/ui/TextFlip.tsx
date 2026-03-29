"use client";

import * as React from "react";

type TextFlipProps = {
	words: string[];
	interval?: number; // ms
	className?: string;
};

export function TextFlip({ words, interval = 1600, className }: TextFlipProps) {
	const [index, setIndex] = React.useState(0);

	React.useEffect(() => {
		if (!words || words.length === 0) return;
		const t = setInterval(() => {
			setIndex((prev) => (prev + 1) % words.length);
		}, interval);
		return () => clearInterval(t);
	}, [words, interval]);

	const word = words[index] ?? "";

	return (
		<span className={className} aria-live="polite" aria-atomic="true">
			<span key={index} className="inline-block flip-word">
				{word}
			</span>
			<style jsx>{`
				.flip-word {
					will-change: transform, opacity;
					backface-visibility: hidden;
					transform-origin: 50% 50%;
					display: inline-block;
					animation: flipIn 700ms ease-in-out;
				}
				@keyframes flipIn {
					0% {
						transform: rotateX(-90deg);
						opacity: 0;
					}
					50% {
						transform: rotateX(15deg);
						opacity: 1;
					}
					100% {
						transform: rotateX(0deg);
						opacity: 1;
					}
				}
			`}</style>
		</span>
	);
}
