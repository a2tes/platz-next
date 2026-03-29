"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { IconCameraSelfie } from "@tabler/icons-react";
import { Photographer, PhotographyService } from "@/services/photographyService";
import { createStandardColumns, createStandardActions, createPhotographyNavigation } from "@/lib/entity-list-helpers";

// Config
const photographersConfig: EntityListConfig<Photographer> = {
	// Entity info
	entityName: "photographer",
	entityNamePlural: "photographers",
	entityDisplayName: "Photographer",
	entityDisplayNamePlural: "Photographers",
	entityDescription: "Build and maintain your directory of photographers.",
	icon: <IconCameraSelfie className="h-8 w-8 text-muted-foreground" />,
	// Query keys
	queryKey: "photographers",
	countsQueryKey: "photographers-counts",
	trashedQueryKey: "trashed-photographers",
	// Service
	service: {
		getItems: PhotographyService.getPhotographers,
		getTrashedItems: PhotographyService.getTrashedPhotographers,
		getCounts: PhotographyService.getPhotographersCounts,
		deleteItem: PhotographyService.deletePhotographer,
		purgeItem: PhotographyService.purgePhotographer,
		restoreItem: PhotographyService.restorePhotographer,
		updateItem: PhotographyService.updatePhotographer,
		publishItem: PhotographyService.publishPhotographer,
		unpublishItem: PhotographyService.unpublishPhotographer,
		bulkDeleteItems: PhotographyService.bulkDeletePhotographers,
		bulkPurgeItems: PhotographyService.bulkPurgePhotographers,
		bulkPublish: PhotographyService.bulkPublishPhotographers,
		bulkUnpublish: PhotographyService.bulkUnpublishPhotographers,
	} as unknown as EntityService<Photographer>,
	// UI - using standard helpers
	columns: createStandardColumns<Photographer>(),
	getActions: createStandardActions<Photographer>(),
	// Edit mode
	editMode: "route",
	editRoute: "/photography/photographers",
	// Navigation
	navigation: createPhotographyNavigation({
		currentPath: "/photography/photographers",
	}),
	// View path for public frontend
	viewItemBasePath: "/photography?p=",
};

function PhotographersPageContent() {
	return <EntityListPage config={photographersConfig} />;
}

export default function PhotographersPage() {
	return (
		<ProtectedRoute>
			<PhotographersPageContent />
		</ProtectedRoute>
	);
}
