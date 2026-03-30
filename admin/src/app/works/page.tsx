"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Work, WorksService } from "@/services/worksService";
import { createStandardColumns, createStandardActions } from "@/lib/entity-list-helpers";
import { IconMovie, IconLayoutGrid } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useBlockEditorStore } from "@/stores/blockEditorStore";
import { SeoButton } from "@/components/settings/SeoButton";

// Block Editor Button Component
function BlockEditorButton() {
	const { openBlockEditor } = useBlockEditorStore();

	const handleOpenBlockEditor = () => {
		// Open block editor for the Works BlockPage
		openBlockEditor("BlockPage", 1, undefined, "Works"); // BlockPage id 1 is WORKS from seed
	};

	return (
		<Button variant="outline" onClick={handleOpenBlockEditor} className="gap-2">
			<IconLayoutGrid className="h-4 w-4" />
			<span className="hidden sm:inline">Block Editor</span>
		</Button>
	);
}

// Config
const worksConfig: EntityListConfig<Work> = {
	// Entity info
	entityName: "work",
	entityNamePlural: "works",
	entityDisplayName: "Work",
	entityDisplayNamePlural: "Works",
	entityDescription: "Create, curate and showcase all your creative projects in one place.",
	// Icon
	icon: <IconMovie className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "works",
	countsQueryKey: "works-counts",
	trashedQueryKey: "trashed-works",

	// Service
	service: {
		getItems: WorksService.getWorks,
		getTrashedItems: WorksService.getTrashedWorks,
		getCounts: WorksService.getWorksCounts,
		deleteItem: WorksService.deleteWork,
		purgeItem: WorksService.purgeWork,
		restoreItem: WorksService.restoreWork,
		updateItem: WorksService.updateWork,
		publishItem: WorksService.publishWork,
		unpublishItem: WorksService.unpublishWork,
		bulkDeleteItems: WorksService.bulkDeleteWorks,
		bulkPurgeItems: WorksService.bulkPurgeWorks,
		bulkPublish: WorksService.bulkPublishWorks,
		bulkUnpublish: WorksService.bulkUnpublishWorks,
	} as unknown as EntityService<Work>,

	// UI - using standard helpers
	columns: createStandardColumns<Work>(),
	getActions: createStandardActions<Work>(),

	// Edit mode
	editMode: "route",
	editRoute: "/works",

	// View path for public frontend (plural to match route)
	viewItemBasePath: "/works",

	// SEO button next to title
	titleActions: <SeoButton pageKey="works" pageTitle="Works" />,

	// Header actions - Block Editor button
	headerActions: <BlockEditorButton />,
};

export default function WorksPage() {
	return (
		<ProtectedRoute>
			<EntityListPage config={worksConfig} />
		</ProtectedRoute>
	);
}
