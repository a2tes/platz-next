"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Starring, WorksService } from "@/services/worksService";
import { createStandardActions, createEntitiesNavigation } from "@/lib/entity-list-helpers";
import { StarringsModal } from "@/components/works/StarringsModal";
import { IconSparkles } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";

// Adapter to convert Starring to modal props
function StarringsModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: Starring | null;
	onSaved: () => void;
}) {
	return <StarringsModal open={open} onOpenChange={onOpenChange} starring={item} onSaved={onSaved} />;
}

// Create columns for starrings with usage count
function createStarringColumns(): Column<Starring>[] {
	return [
		{
			key: "title",
			header: "Name",
			render: (item) => (
				<>
					<h3 className="font-semibold text-foreground line-clamp-2 inline">{item.title}</h3>
					{item.status === "DRAFT" && <span className="text-sm text-muted-foreground pl-2 italic">— Draft</span>}
				</>
			),
		},
		{
			key: "usage",
			header: "Used In",
			width: "w-40",
			render: (item) => {
				if (!item._count) return <span className="text-muted-foreground">-</span>;
				const parts = [];
				if (item._count.works > 0) parts.push(`${item._count.works} ${item._count.works === 1 ? "work" : "works"}`);
				if (item._count.photography > 0)
					parts.push(`${item._count.photography} ${item._count.photography === 1 ? "photo" : "photos"}`);
				return <div className="text-sm text-muted-foreground">{parts.length > 0 ? parts.join(", ") : "-"}</div>;
			},
		},
		{
			key: "date",
			header: "Date",
			width: "w-44",
			render: (item) => renderDateColumn("Created", item.createdAt),
		},
	];
}

const starringsConfig: EntityListConfig<Starring> = {
	// Entity info
	entityName: "starring",
	entityNamePlural: "starrings",
	entityDisplayName: "Starring",
	entityDisplayNamePlural: "Starrings",
	entityDescription: "Add, organize and spotlight the talent appearing in your productions.",

	// Icon
	icon: <IconSparkles className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "starrings",
	countsQueryKey: "starrings-counts",
	trashedQueryKey: "trashed-starrings",

	// Service
	service: {
		getItems: WorksService.getStarrings,
		getTrashedItems: WorksService.getTrashedStarrings,
		getCounts: WorksService.getStarringsCounts,
		deleteItem: WorksService.deleteStarring,
		purgeItem: WorksService.purgeStarring,
		restoreItem: WorksService.restoreStarring,
		publishItem: WorksService.publishStarring,
		unpublishItem: WorksService.unpublishStarring,
		bulkDeleteItems: WorksService.bulkDeleteStarrings,
		bulkPurgeItems: WorksService.bulkPurgeStarrings,
	} as unknown as EntityService<Starring>,

	// UI - using custom columns with usage count
	columns: createStarringColumns(),
	getActions: createStandardActions<Starring>(),

	// Edit mode
	editMode: "modal",
	EditorModal: StarringsModalAdapter,

	// Navigation - now using Entities navigation
	navigation: createEntitiesNavigation({ currentPath: "/entities/starrings" }),

	// View path for public frontend (singular)
	viewItemBasePath: "/starrings",
};

function StarringsPageContent() {
	return <EntityListPage config={starringsConfig} />;
}

export default function StarringsPage() {
	return (
		<ProtectedRoute>
			<StarringsPageContent />
		</ProtectedRoute>
	);
}
