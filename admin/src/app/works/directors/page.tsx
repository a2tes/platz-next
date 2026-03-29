"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Director, WorksService } from "@/services/worksService";
import { createStandardColumns, createStandardActions, createWorksNavigation } from "@/lib/entity-list-helpers";
import React from "react";
import { useBlockEditorStore } from "@/stores/blockEditorStore";
import { IconArmchair } from "@tabler/icons-react";
import { SeoButton } from "@/components/settings/SeoButton";

const baseConfig: EntityListConfig<Director> = {
	// Entity info
	entityName: "director",
	entityNamePlural: "directors",
	entityDisplayName: "Director",
	entityDisplayNamePlural: "Directors",
	entityDescription: "Build and manage your roster of directors featured across your works.",

	// Icon
	icon: <IconArmchair className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "directors",
	countsQueryKey: "directors-counts",
	trashedQueryKey: "trashed-directors",

	// Service - type assertion kullanarak basitleştirme
	service: {
		getItems: WorksService.getDirectors,
		getTrashedItems: WorksService.getTrashedDirectors,
		getCounts: WorksService.getDirectorsCounts,
		deleteItem: WorksService.deleteDirector,
		purgeItem: WorksService.purgeDirector,
		restoreItem: WorksService.restoreDirector,
		publishItem: WorksService.publishDirector,
		unpublishItem: WorksService.unpublishDirector,
		bulkDeleteItems: WorksService.bulkDeleteDirectors,
		bulkPurgeItems: WorksService.bulkPurgeDirectors,
	} as unknown as EntityService<Director>,

	// UI - standard helpers kullan
	columns: createStandardColumns<Director>(),
	getActions: (cfg) => {
		// Base actions
		const base = createStandardActions<Director>()(cfg);
		// Inject Block Editor action after Preview/View
		base.splice(1, 0, {
			label: "Block Editor",
			onClick: () => {}, // replaced at runtime inside DirectorsPageContent
			show: () => cfg.filterTab !== "trash",
		});
		return base;
	},

	// Edit mode
	editMode: "route",
	editRoute: "/works/directors",

	// Navigation
	navigation: createWorksNavigation({ currentPath: "/works/directors" }),

	// View path for public frontend (singular)
	viewItemBasePath: "/directors",

	// SEO button next to title
	titleActions: <SeoButton pageKey="directors" pageTitle="Directors" />,
};

function DirectorsPageContent() {
	const openBlockEditor = useBlockEditorStore((s) => s.openBlockEditor);

	// Wrap config to override action handler (inject runtime onClick)
	const config: EntityListConfig<Director> = React.useMemo(
		() => ({
			...baseConfig,
			getActions: (args) => {
				const actions = baseConfig.getActions!(args);
				// Find Block Editor action and replace its onClick with our handler
				return actions.map((a) =>
					a.label === "Block Editor"
						? {
								...a,
								onClick: (item: Director) => {
									openBlockEditor("Director", item.id, undefined, item.title);
								},
							}
						: a,
				);
			},
		}),
		[openBlockEditor],
	);

	return <EntityListPage config={config} />;
}

export default function DirectorsPage() {
	return (
		<ProtectedRoute>
			<DirectorsPageContent />
		</ProtectedRoute>
	);
}
