"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Animation, AnimationsService } from "@/services/animationsService";
import { createStandardColumns, createStandardActions } from "@/lib/entity-list-helpers";
import { IconMovie, IconLayoutGrid } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useBlockEditorStore } from "@/stores/blockEditorStore";
import { blockPagesService } from "@/services/blocksService";
import { SeoButton } from "@/components/settings/SeoButton";
import React from "react";

// Block Editor Button Component
function BlockEditorButton() {
	const { openBlockEditor } = useBlockEditorStore();
	const [pageId, setPageId] = React.useState<number | null>(null);

	React.useEffect(() => {
		blockPagesService
			.getBlockPageByType("ANIMATIONS")
			.then((page) => {
				setPageId(page.id);
			})
			.catch(() => {});
	}, []);

	const handleOpenBlockEditor = () => {
		if (pageId) {
			openBlockEditor("BlockPage", pageId, undefined, "Animations");
		}
	};

	return (
		<Button variant="outline" onClick={handleOpenBlockEditor} disabled={!pageId} className="gap-2">
			<IconLayoutGrid className="h-4 w-4" />
			<span className="hidden sm:inline">Block Editor</span>
		</Button>
	);
}

// Config
const animationsConfig: EntityListConfig<Animation> = {
	// Entity info
	entityName: "animation",
	entityNamePlural: "animations",
	entityDisplayName: "Animation",
	entityDisplayNamePlural: "Animations",
	entityDescription: "Create, curate and showcase your animation projects.",
	// Icon
	icon: <IconMovie className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "animations",
	countsQueryKey: "animations-counts",
	trashedQueryKey: "trashed-animations",

	// Service
	service: {
		getItems: AnimationsService.getAnimations,
		getTrashedItems: AnimationsService.getTrashedAnimations,
		getCounts: AnimationsService.getAnimationsCounts,
		deleteItem: AnimationsService.deleteAnimation,
		purgeItem: AnimationsService.purgeAnimation,
		restoreItem: AnimationsService.restoreAnimation,
		updateItem: AnimationsService.updateAnimation,
		publishItem: AnimationsService.publishAnimation,
		unpublishItem: AnimationsService.unpublishAnimation,
		bulkDeleteItems: AnimationsService.bulkDeleteAnimations,
		bulkPurgeItems: AnimationsService.bulkPurgeAnimations,
		bulkPublish: AnimationsService.bulkPublishAnimations,
		bulkUnpublish: AnimationsService.bulkUnpublishAnimations,
	} as unknown as EntityService<Animation>,

	// UI - using standard helpers
	columns: createStandardColumns<Animation>(),
	getActions: createStandardActions<Animation>(),

	// Edit mode
	editMode: "route",
	editRoute: "/animations",

	// View path for public frontend (singular)
	viewItemBasePath: "/animations",

	// SEO button next to title
	titleActions: <SeoButton pageKey="animations" pageTitle="Animations" />,

	// Header actions - Block Editor button
	headerActions: <BlockEditorButton />,
};

function AnimationsPageContent() {
	return <EntityListPage config={animationsConfig} />;
}

export default function AnimationsPage() {
	return (
		<ProtectedRoute>
			<AnimationsPageContent />
		</ProtectedRoute>
	);
}
