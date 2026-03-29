"use client";
import * as React from "react";
import { TextGenerateEffect } from "./text-generate-effect";

type TextItem = {
	text: string;
	style?: React.CSSProperties;
};

type TextGenerateSequenceProps = {
	texts: string[] | TextItem[];
	className?: string;
	filter?: boolean;
	duration?: number;
	staggerDelay?: number;
	style?: React.CSSProperties;
};

export function TextGenerateSequence({
	texts,
	className,
	filter = true,
	duration = 0.3,
	staggerDelay = 0.05,
}: TextGenerateSequenceProps) {
	const [visibleIndex, setVisibleIndex] = React.useState(0);

	// Normalize texts to TextItem format
	const normalizedTexts: TextItem[] = React.useMemo(() => {
		return texts.map((item) =>
			typeof item === "string" ? { text: item } : item
		);
	}, [texts]);

	const handleComplete = React.useCallback(() => {
		if (visibleIndex < normalizedTexts.length - 1) {
			setVisibleIndex((prev) => prev + 1);
		}
	}, [visibleIndex, normalizedTexts.length]);

	return (
		<>
			{normalizedTexts.map((item, index) => {
				if (index > visibleIndex) return null;

				const wordCount = item.text.split(" ").length;
				const animationDuration = duration + wordCount * staggerDelay;

				return (
					<TextGenerateEffect
						key={index}
						words={item.text}
						className={className}
						style={item.style}
						filter={filter}
						duration={duration}
						staggerDelay={staggerDelay}
						onComplete={index === visibleIndex ? handleComplete : undefined}
						animationDuration={animationDuration}
					/>
				);
			})}
		</>
	);
}
