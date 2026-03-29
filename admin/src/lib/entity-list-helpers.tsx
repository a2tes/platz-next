import { Column, Action, renderDateColumn } from "@/components/ui/data-list";
import { BaseEntity, FilterTab, NavigationItem } from "@/components/page/entity-list-page";

/**
 * Standard columns for entity lists
 * These can be reused across Works, Directors, Starrings, etc.
 */

export function createTitleColumn<T extends BaseEntity>(): Column<T> {
	return {
		key: "title",
		header: "Title",
		render: (item) => (
			<>
				<h3 className="font-semibold text-foreground line-clamp-2 inline">{item.title}</h3>
				{item.status === "DRAFT" && <span className="text-sm text-muted-foreground pl-2 italic">— Draft</span>}
				{item.status === "UNLISTED" && <span className="text-sm text-muted-foreground pl-2 italic">— Unlisted</span>}
			</>
		),
	};
}

export function createCreatorColumn<T extends BaseEntity>(): Column<T> {
	return {
		key: "creator",
		header: "Creator",
		width: "w-32",
		render: (item) => <span className="text-sm text-muted-foreground">{item.creator?.name || "Unknown"}</span>,
	};
}

export function createDateColumn<T extends BaseEntity>(): Column<T> {
	return {
		key: "date",
		header: "Date",
		width: "w-44",
		render: (item) => {
			if ((item.status === "PUBLISHED" || item.status === "UNLISTED") && item.publishedAt) {
				return renderDateColumn("Published", item.publishedAt);
			}
			return renderDateColumn("Last Modified", item.updatedAt);
		},
	};
}

/**
 * Create standard columns set for entity list
 */
export function createStandardColumns<T extends BaseEntity>(): Column<T>[] {
	return [createTitleColumn<T>(), createCreatorColumn<T>(), createDateColumn<T>()];
}

/**
 * Standard actions factory for entity lists
 */
export function createStandardActions<T extends BaseEntity>(): (config: {
	filterTab: FilterTab;
	onEdit?: (item: T) => void;
	onTogglePublish: (item: T) => void;
	onDelete: (item: T) => void;
	onRestore?: (item: T) => void;
	viewItemBasePath?: string; // e.g., "/work", "/photographer"
	viewBasePath?: string; // e.g., "/works", "/photographers"
}) => Action<T>[] {
	return ({ filterTab, onEdit, onTogglePublish, onDelete, onRestore, viewItemBasePath, viewBasePath }) => {
		const publicUrl =
			`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}` ||
			`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

		const basePath = viewItemBasePath ?? viewBasePath;

		return [
			{
				label: (item: T) => (item.status === "PUBLISHED" || item.status === "UNLISTED" ? "View" : "Preview"),
				onClick: (item: T) => {
					if (item.slug && basePath) {
						const separator = basePath.endsWith("=") ? "" : "/";
						window.open(`${publicUrl}${basePath}${separator}${item.slug}`, "_blank");
					}
				},
				show: (item: T) => filterTab !== "trash" && !!item.slug && !!basePath,
			},
			{
				label: "Edit",
				onClick: onEdit!,
				show: () => filterTab !== "trash" && !!onEdit,
			},
			{
				label: "Unpublish",
				onClick: onTogglePublish,
				show: (item: T) => filterTab !== "trash" && (item.status === "PUBLISHED" || item.status === "UNLISTED"),
			},
			{
				label: "Publish",
				onClick: onTogglePublish,
				show: (item: T) => filterTab !== "trash" && item.status === "DRAFT",
			},
			{
				label: "Restore",
				onClick: onRestore!,
				show: () => filterTab === "trash" && !!onRestore,
			},
			{
				label: filterTab === "trash" ? "Delete Permanently" : "Delete",
				onClick: onDelete,
				className: "text-destructive hover:underline",
			},
		];
	};
}

/**
 * Create standard navigation for Works/Directors/Presentations/Animations
 */
export interface WorksNavigationConfig {
	currentPath: "/works" | "/works/directors" | "/animations";
}

export function createWorksNavigation(config: WorksNavigationConfig): NavigationItem[] {
	return [
		{
			label: "Works",
			href: "/works",
			isActive: config.currentPath === "/works",
		},
		{
			label: "Directors",
			href: "/works/directors",
			isActive: config.currentPath === "/works/directors",
		},
	];
}

/**
 * Create standard navigation for Entities (Clients/Agencies/Starrings)
 */
export interface EntitiesNavigationConfig {
	currentPath:
		| "/entities/clients"
		| "/entities/agencies"
		| "/entities/starrings"
		| "/entities/disciplines"
		| "/entities/sectors";
}

export function createEntitiesNavigation(config: EntitiesNavigationConfig): NavigationItem[] {
	return [
		{
			label: "Clients",
			href: "/entities/clients",
			isActive: config.currentPath === "/entities/clients",
		},
		{
			label: "Agencies",
			href: "/entities/agencies",
			isActive: config.currentPath === "/entities/agencies",
		},
		{
			label: "Starrings",
			href: "/entities/starrings",
			isActive: config.currentPath === "/entities/starrings",
		},
		{
			label: "Disciplines",
			href: "/entities/disciplines",
			isActive: config.currentPath === "/entities/disciplines",
		},
		{
			label: "Sectors",
			href: "/entities/sectors",
			isActive: config.currentPath === "/entities/sectors",
		},
	];
}

/**
 * Create standard navigation for Photographer/Categories
 */
export interface PhotographyNavigationConfig {
	currentPath: "/photography" | "/photography/photographers" | "/photography/categories";
}

export function createPhotographyNavigation(config: PhotographyNavigationConfig): NavigationItem[] {
	return [
		{
			label: "Photography",
			href: "/photography",
			isActive: config.currentPath === "/photography",
		},
		{
			label: "Photographers",
			href: "/photography/photographers",
			isActive: config.currentPath === "/photography/photographers",
		},
		{
			label: "Categories",
			href: "/photography/categories",
			isActive: config.currentPath === "/photography/categories",
		},
	];
}

/**
 * Generic navigation creator
 */
export interface NavigationConfig {
	items: Array<{
		label: string;
		href: string;
	}>;
	currentPath: string;
}

export function createNavigation(config: NavigationConfig): NavigationItem[] {
	return config.items.map((item) => ({
		...item,
		isActive: config.currentPath === item.href,
	}));
}
