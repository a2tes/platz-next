import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Calculate clip-path inset values from crop settings
 * @param cropX - Left offset percentage (0-100)
 * @param cropY - Top offset percentage (0-100)
 * @param cropW - Width percentage (0-100)
 * @param cropH - Height percentage (0-100)
 * @returns CSS clip-path inset value
 */
export function calculateClipPath(
	cropX: number = 0,
	cropY: number = 0,
	cropW: number = 100,
	cropH: number = 100,
): string {
	const top = cropY;
	const right = 100 - (cropX + cropW);
	const bottom = 100 - (cropY + cropH);
	const left = cropX;

	return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse time string to seconds
 */
export function parseTime(timeString: string): number {
	const parts = timeString.split(":").map(Number);
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	}
	if (parts.length === 2) {
		return parts[0] * 60 + parts[1];
	}
	return parts[0] || 0;
}
