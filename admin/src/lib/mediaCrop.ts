const API_URL =
	`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}` ||
	`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

export type CropFormat = "jpeg" | "png" | "webp" | "avif";

export interface CropUrlOptions {
	w?: number; // output width in px
	h?: number; // output height in px
	format?: CropFormat;
	q?: number; // 1..100
}

/**
 * Build URL to the backend lazy crop endpoint for a given mediable.
 * The crop must be previously saved via POST /api/media/crops.
 */
export function getCroppedImageUrl(
	mediaId: number,
	subjectType: string,
	subjectId: number,
	usageKey: string,
	opts: CropUrlOptions = {}
): string {
	const url = new URL(`/api/media/crop/${mediaId}`, API_URL);
	url.searchParams.set("subjectType", subjectType);
	url.searchParams.set("subjectId", String(subjectId));
	url.searchParams.set("usageKey", usageKey);
	if (opts.w) url.searchParams.set("w", String(opts.w));
	if (opts.h) url.searchParams.set("h", String(opts.h));
	if (opts.format) url.searchParams.set("format", opts.format);
	if (opts.q) url.searchParams.set("q", String(opts.q));
	return url.toString();
}

/**
 * Convenience: returns attributes for Next/Image or <img>.
 */
export function buildCroppedImgAttrs(
	mediaId: number,
	subjectType: string,
	subjectId: number,
	usageKey: string,
	opts: CropUrlOptions & { alt?: string } = {}
) {
	const src = getCroppedImageUrl(
		mediaId,
		subjectType,
		subjectId,
		usageKey,
		opts
	);
	const { w, h, alt } = opts;
	return { src, width: w, height: h, alt: alt || "" };
}
