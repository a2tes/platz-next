"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Simple single-value slider
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
	value?: number[];
	onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
	({ className, value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
		return (
			<input
				ref={ref}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value[0]}
				onChange={(e) => onValueChange?.([Number(e.target.value)])}
				className={cn("w-full h-2 appearance-none bg-secondary rounded-lg cursor-pointer accent-primary", className)}
				{...props}
			/>
		);
	},
);
Slider.displayName = "Slider";

// Range slider with two thumbs - custom implementation
interface RangeSliderProps {
	min?: number;
	max?: number;
	step?: number;
	value?: [number, number];
	onValueChange?: (value: [number, number]) => void;
	className?: string;
}

const RangeSlider = React.forwardRef<HTMLDivElement, RangeSliderProps>(
	({ min = 0, max = 100, step = 1, value = [0, 100], onValueChange, className }, ref) => {
		const trackRef = React.useRef<HTMLDivElement>(null);
		const [dragging, setDragging] = React.useState<"start" | "end" | null>(null);

		const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

		const getValueFromPosition = (clientX: number) => {
			if (!trackRef.current) return 0;
			const rect = trackRef.current.getBoundingClientRect();
			const percentage = (clientX - rect.left) / rect.width;
			const rawValue = min + percentage * (max - min);
			const steppedValue = Math.round(rawValue / step) * step;
			return Math.max(min, Math.min(max, steppedValue));
		};

		const handleMouseDown = (thumb: "start" | "end") => (e: React.MouseEvent) => {
			e.preventDefault();
			setDragging(thumb);
		};

		const handleMouseMove = React.useCallback(
			(e: MouseEvent) => {
				if (!dragging) return;
				const newValue = getValueFromPosition(e.clientX);

				if (dragging === "start") {
					onValueChange?.([Math.min(newValue, value[1] - step), value[1]]);
				} else {
					onValueChange?.([value[0], Math.max(newValue, value[0] + step)]);
				}
			},
			[dragging, value, onValueChange, step],
		);

		const handleMouseUp = React.useCallback(() => {
			setDragging(null);
		}, []);

		React.useEffect(() => {
			if (dragging) {
				window.addEventListener("mousemove", handleMouseMove);
				window.addEventListener("mouseup", handleMouseUp);
				return () => {
					window.removeEventListener("mousemove", handleMouseMove);
					window.removeEventListener("mouseup", handleMouseUp);
				};
			}
		}, [dragging, handleMouseMove, handleMouseUp]);

		const startPercent = getPercentage(value[0]);
		const endPercent = getPercentage(value[1]);

		return (
			<div ref={ref} className={cn("relative flex w-full touch-none select-none items-center h-5", className)}>
				{/* Track */}
				<div ref={trackRef} className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
					{/* Range fill */}
					<div
						className="absolute h-full bg-primary"
						style={{
							left: `${startPercent}%`,
							width: `${endPercent - startPercent}%`,
						}}
					/>
				</div>

				{/* Start Thumb */}
				<div
					onMouseDown={handleMouseDown("start")}
					className="absolute block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					style={{ left: `calc(${startPercent}% - 10px)` }}
				/>

				{/* End Thumb */}
				<div
					onMouseDown={handleMouseDown("end")}
					className="absolute block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					style={{ left: `calc(${endPercent}% - 10px)` }}
				/>
			</div>
		);
	},
);
RangeSlider.displayName = "RangeSlider";

export { Slider, RangeSlider };
