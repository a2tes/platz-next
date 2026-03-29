export function slugify(text: string): string {
	// Turkish character map
	const turkishMap: { [key: string]: string } = {
		ş: "s",
		Ş: "s",
		ğ: "g",
		Ğ: "g",
		ü: "u",
		Ü: "u",
		ı: "i",
		İ: "i",
		ö: "o",
		Ö: "o",
		ç: "c",
		Ç: "c",
	};

	// Replace Turkish characters
	let result = text
		.split("")
		.map((char) => turkishMap[char] || char)
		.join("");

	return result
		.toString()
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-") // Replace spaces with -
		.replace(/[^\w\-]+/g, "") // Remove all non-word chars
		.replace(/\-\-+/g, "-") // Replace multiple - with single -
		.replace(/^-+/, "") // Trim - from start of text
		.replace(/-+$/, ""); // Trim - from end of text
}

export async function generateUniqueSlug(
	baseSlug: string,
	checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
	let slug = baseSlug;
	let counter = 1;

	while (await checkExists(slug)) {
		slug = `${baseSlug}-${counter}`;
		counter++;
	}

	return slug;
}
