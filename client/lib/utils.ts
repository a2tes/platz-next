import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Get the API base URL from environment variables
 */
export function getApiUrl(): string {
	return process.env.NEXT_PUBLIC_PROTOCOL && process.env.NEXT_PUBLIC_HOSTNAME
		? `${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}`
		: `http://localhost:${process.env.NEXT_PUBLIC_PORT || 5051}`;
}
