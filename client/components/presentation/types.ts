export interface PresentationWork {
	id: number;
	slug: string;
	title: string;
	shortDescription: string;
	subtitle?: string;
	caseStudy?: string;
	videoUrl: string | null;
	hlsUrl: string | null;
	optimizedVideoUrl: string | null;
	images: {
		thumbnail?: string;
		small?: string;
		medium?: string;
		large?: string;
		original?: string;
	} | null;
	directors: Array<{ title: string; slug: string }>;
	starrings: Array<{ title: string; slug: string }>;
	clients: string[];
	agencies: string[];
}

export interface PresentationAnimation {
	id: number;
	slug: string;
	title: string;
	shortDescription: string;
	videoUrl: string | null;
	hlsUrl: string | null;
	optimizedVideoUrl: string | null;
	images: {
		thumbnail?: string;
		small?: string;
		medium?: string;
		large?: string;
		original?: string;
	} | null;
	clients: string[];
	agencies: string[];
}

export interface PresentationPhotography {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	year: string | null;
	location: string | null;
	images: {
		thumbnail?: string;
		small?: string;
		medium?: string;
		large?: string;
		original?: string;
	} | null;
	photographer: { id: number; title: string } | null;
	clients: string[];
	categories: string[];
}

export interface PresentationItem {
	itemType: "WORK" | "ANIMATION" | "PHOTOGRAPHY" | "EXTERNAL_LINK";
	sortOrder: number;
	work?: PresentationWork;
	animation?: PresentationAnimation;
	photography?: PresentationPhotography;
	director?: {
		id: number;
		title: string;
		slug: string;
		avatar: any;
	};
	externalUrl?: string;
	externalTitle?: string;
	externalDescription?: string;
	externalThumbnail?: {
		images?: {
			thumbnail?: string;
			small?: string;
			medium?: string;
			large?: string;
			original?: string;
		};
	} | null;
}

export interface PresentationSection {
	title: string;
	type: string;
	items: PresentationItem[];
}

export interface PresentationData {
	title: string;
	clientName: string | null;
	clientNote: string | null;
	autoPlayEnabled: boolean;
	photoSlideDuration: number;
	sections: PresentationSection[];
}

/** Flattened item for auto-play sequencing */
export interface PlayableItem {
	sectionIndex: number;
	itemIndex: number;
	sectionTitle: string;
	item: PresentationItem;
}
