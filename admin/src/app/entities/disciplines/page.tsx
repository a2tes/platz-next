"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Discipline, disciplinesService } from "@/services/disciplinesService";
import { createStandardActions, createEntitiesNavigation } from "@/lib/entity-list-helpers";
import { DisciplinesModal } from "@/components/entities/DisciplinesModal";
import { IconBrain } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";

// Extended Discipline type with title for BaseEntity compatibility
interface DisciplineWithTitle extends Discipline {
	title: string;
}

// Adapter to convert Discipline to modal props
function DisciplinesModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: DisciplineWithTitle | null;
	onSaved: () => void;
}) {
	return <DisciplinesModal open={open} onOpenChange={onOpenChange} discipline={item} onSaved={onSaved} />;
}

// Create columns for disciplines (using name instead of title)
function createDisciplineColumns(): Column<DisciplineWithTitle>[] {
	return [
		{
			key: "name",
			header: "Name",
			render: (item) => (
				<>
					<h3 className="font-semibold text-foreground line-clamp-2 inline">{item.name}</h3>
					{item.status === "DRAFT" && <span className="text-sm text-muted-foreground pl-2 italic">— Draft</span>}
				</>
			),
		},
		{
			key: "usage",
			header: "Used In",
			width: "w-52",
			render: (item) => {
				if (!item._count) return <span className="text-muted-foreground">-</span>;
				const parts = [];
				if (item._count.works > 0) parts.push(`${item._count.works} ${item._count.works === 1 ? "work" : "works"}`);
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

// Wrap the service to match EntityService interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const disciplineEntityService: EntityService<DisciplineWithTitle> = {
	getItems: async (params) => {
		const result = await disciplinesService.getDisciplines(params as any);
		return {
			data: result.disciplines.map((d) => ({ ...d, title: d.name })),
			meta: {
				pagination: {
					page: result.pagination.page,
					limit: result.pagination.limit,
					totalPages: result.pagination.totalPages,
					totalItems: result.pagination.total,
				},
			},
		} as any;
	},
	getTrashedItems: async (params) => {
		const result = await disciplinesService.getTrashedDisciplines(params as any);
		return {
			data: result.disciplines.map((d) => ({ ...d, title: d.name })),
			meta: {
				pagination: {
					page: result.pagination.page,
					limit: result.pagination.limit,
					totalPages: result.pagination.totalPages,
					totalItems: result.pagination.total,
				},
			},
		} as any;
	},
	getCounts: disciplinesService.getCounts as any,
	deleteItem: disciplinesService.deleteDiscipline,
	purgeItem: disciplinesService.purgeDiscipline,
	restoreItem: disciplinesService.restoreDiscipline as any,
	publishItem: disciplinesService.publishDiscipline as any,
	unpublishItem: disciplinesService.unpublishDiscipline as any,
	bulkDeleteItems: disciplinesService.bulkDeleteDisciplines,
	bulkPurgeItems: disciplinesService.bulkPurgeDisciplines,
};

const disciplinesConfig: EntityListConfig<DisciplineWithTitle> = {
	// Entity info
	entityName: "discipline",
	entityNamePlural: "disciplines",
	entityDisplayName: "Discipline",
	entityDisplayNamePlural: "Disciplines",
	entityDescription: "Manage disciplines that can be associated with Works.",

	// Icon
	icon: <IconBrain className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "disciplines",
	countsQueryKey: "disciplines-counts",
	trashedQueryKey: "trashed-disciplines",

	// Service
	service: disciplineEntityService,

	// UI
	columns: createDisciplineColumns(),
	getActions: createStandardActions<DisciplineWithTitle>(),

	// Edit mode
	editMode: "modal",
	EditorModal: DisciplinesModalAdapter,

	// Navigation
	navigation: createEntitiesNavigation({ currentPath: "/entities/disciplines" }),
};

function DisciplinesPageContent() {
	return <EntityListPage config={disciplinesConfig} />;
}

export default function DisciplinesPage() {
	return (
		<ProtectedRoute>
			<DisciplinesPageContent />
		</ProtectedRoute>
	);
}
