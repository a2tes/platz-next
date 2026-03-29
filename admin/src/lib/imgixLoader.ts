"use client";

export default function imgixLoader({
	src,
	width,
	quality,
}: {
	src: string;
	width: number;
	quality?: number;
}) {
	// Ensure src is a string
	if (!src) return "";

	try {
		const url = new URL(src);
		const params = url.searchParams;

		// Set Imgix parameters
		params.set("auto", params.get("auto") || "format,compress");
		params.set("fit", params.get("fit") || "max");
		params.set("w", params.get("w") || width.toString());

		if (quality) {
			params.set("q", quality.toString());
		}

		return url.href;
	} catch (e) {
		// If src is not a valid URL (e.g. relative path), return it as is
		// or handle it based on your needs. For now, we assume absolute URLs from API.
		return src;
	}
}
