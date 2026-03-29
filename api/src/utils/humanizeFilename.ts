/**
 * Humanize filename by converting kebab-case, snake_case, and camelCase to Title Case
 * Removes file extension and cleans up the name
 *
 * Examples:
 * "arthousestudio-4338015.jpg" -> "Arthousestudio 4338015"
 * "manuela-adler-344311-949194.jpg" -> "Manuela Adler 344311 949194"
 * "frans_-van-heerden-624015.jpg" -> "Frans Van Heerden 624015"
 */
export function humanizeFilename(filename: string): string {
	if (!filename) return "";

	// Remove file extension
	const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

	// Replace hyphens, underscores, and other separators with spaces
	let humanized = nameWithoutExt
		.replace(/[-_./]+/g, " ")
		.replace(/\s+/g, " ") // Replace multiple spaces with single space
		.trim();

	// Convert to Title Case: capitalize each word
	humanized = humanized
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");

	return humanized;
}
