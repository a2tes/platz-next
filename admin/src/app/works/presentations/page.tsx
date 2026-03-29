"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Presentation, PresentationService } from "@/services/presentationService";
import { createStandardColumns, createWorksNavigation } from "@/lib/entity-list-helpers";
import { IconPresentation } from "@tabler/icons-react";

// Custom actions to handle specific URL structure for presentations
const getPresentationActions = ({ filterTab, onEdit, onTogglePublish, onDelete, onRestore, onPurge }: any) => {
	const publicUrl =
		`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}` ||
		`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

	return [
		{
			label: (item: Presentation) => (item.status === "PUBLISHED" ? "View" : "Preview"),
			onClick: (item: Presentation) => {
				window.open(`${publicUrl}/directors?ref=${item.token}`, "_blank");
			},
			show: (item: Presentation) => filterTab !== "trash",
		},
		{
			label: "Edit",
			onClick: onEdit!,
			show: () => filterTab !== "trash" && !!onEdit,
		},
		{
			label: "Unpublish",
			onClick: onTogglePublish,
			show: (item: Presentation) => filterTab !== "trash" && item.status === "PUBLISHED",
		},
		{
			label: "Publish",
			onClick: onTogglePublish,
			show: (item: Presentation) => filterTab !== "trash" && item.status === "DRAFT",
		},
		{
			label: "Delete",
			onClick: onDelete,
			className: "text-destructive hover:underline",
			show: () => filterTab !== "trash",
		},
		{
			label: "Restore",
			onClick: onRestore,
			show: () => filterTab === "trash",
		},
		{
			label: "Delete Permanently",
			onClick: onPurge,
			className: "text-destructive hover:underline",
			show: () => filterTab === "trash",
		},
	];
};

// Config
const presentationsConfig: EntityListConfig<Presentation> = {
	// Entity info
	entityName: "presentation",
	entityNamePlural: "presentations",
	entityDisplayName: "Presentation",
	entityDisplayNamePlural: "Presentations",
	entityDescription: "Create polished, share-ready presentations tailored for your clients.",
	// Icon
	icon: <IconPresentation className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "presentations",
	countsQueryKey: "presentations-counts",
	trashedQueryKey: "trashed-presentations",

	// Service
	service: PresentationService as unknown as EntityService<Presentation>,

	// UI
	columns: createStandardColumns<Presentation>(),
	getActions: getPresentationActions,

	// Edit mode
	editMode: "route",
	editRoute: "/works/presentations",

	// Navigation
	// navigation: removed - this page is deprecated, use /presentations instead

	// View path (unused because of custom actions, but required by type)
	viewItemBasePath: "/directors",
};

function PresentationsPageContent() {
	return <EntityListPage config={presentationsConfig} />;
}

export default function PresentationsPage() {
	return (
		<ProtectedRoute>
			<PresentationsPageContent />
		</ProtectedRoute>
	);
}
