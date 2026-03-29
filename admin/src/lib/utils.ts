import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
	const trMap: { [key: string]: string } = {
		ç: "c",
		Ç: "c",
		ğ: "g",
		Ğ: "g",
		ı: "i",
		I: "i",
		İ: "i",
		ö: "o",
		Ö: "o",
		ş: "s",
		Ş: "s",
		ü: "u",
		Ü: "u",
	};

	return text
		.split("")
		.map((char) => trMap[char] || char)
		.join("")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-") // Replace spaces with -
		.replace(/[^\w\-]+/g, "") // Remove all non-word chars
		.replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

export function formatDateTime(input: string | number | Date) {
	const date = new Date(input);

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${year}.${month}.${day} ${hours}:${minutes}`;
}

export function getTimeAgo(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
	const weeks = Math.floor(days / 7);
	if (weeks < 4) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
	const months = Math.floor(days / 30);
	return `${months} month${months > 1 ? "s" : ""} ago`;
}
