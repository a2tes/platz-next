"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { PhotoCategory, PhotographyService } from "@/services/photographyService";
import { createStandardColumns, createStandardActions, createPhotographyNavigation } from "@/lib/entity-list-helpers";
import { PhotoCategoriesModal } from "@/components/photography/PhotoCategoriesModal";
import { IconLibraryPhoto } from "@tabler/icons-react";

function PhotoCategoriesModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: PhotoCategory | null;
	onSaved: () => void;
}) {
	return <PhotoCategoriesModal open={open} onOpenChange={onOpenChange} category={item} onSaved={onSaved} />;
}

const categoriesConfig: EntityListConfig<PhotoCategory> = {
	// Entity info
	entityName: "category",
	entityNamePlural: "categories",
	entityDisplayName: "Category",
	entityDisplayNamePlural: "Categories",
	entityDescription: "Organize and structure your photo categories with ease.",

	icon: <IconLibraryPhoto className="h-8 w-8 text-muted-foreground" />,
	// Query keys
	queryKey: "photo-categories",
	countsQueryKey: "photo-categories-counts",
	trashedQueryKey: "trashed-photo-categories",

	// Service
	service: {
		getItems: PhotographyService.getCategories,
		getTrashedItems: PhotographyService.getTrashedCategories,
		getCounts: PhotographyService.getCategoriesCounts,
		deleteItem: PhotographyService.deleteCategory,
		purgeItem: PhotographyService.purgeCategory,
		restoreItem: PhotographyService.restoreCategory,
		publishItem: PhotographyService.publishCategory,
		unpublishItem: PhotographyService.unpublishCategory,
		bulkDeleteItems: PhotographyService.bulkDeleteCategories,
		bulkPurgeItems: PhotographyService.bulkPurgeCategories,
	} as unknown as EntityService<PhotoCategory>,

	// UI - using standard helpers
	columns: createStandardColumns<PhotoCategory>(),
	getActions: createStandardActions<PhotoCategory>(),

	// Edit mode
	editMode: "modal",
	EditorModal: PhotoCategoriesModalAdapter,

	// Navigation
	navigation: createPhotographyNavigation({
		currentPath: "/photography/categories",
	}),

	// View path for public frontend (singular)
	viewItemBasePath: "/photography?c=",
};

function CategoriesPageContent() {
	return <EntityListPage config={categoriesConfig} />;
}

export default function CategoriesPage() {
	return (
		<ProtectedRoute>
			<CategoriesPageContent />
		</ProtectedRoute>
	);
}
