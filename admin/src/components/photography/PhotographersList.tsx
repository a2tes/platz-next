"use client";

import * as React from "react";
import { Photographer } from "@/services/photographyService";
import {
	DataList,
	Column,
	Action,
	renderDateColumn,
} from "@/components/ui/data-list";

interface PhotographersListProps {
	photographers: Photographer[];
	onEdit?: (p: Photographer) => void;
	onDelete?: (p: Photographer) => void;
	// Bulk selection
	selectedIds?: Set<number>;
	onToggleSelect?: (id: number, checked: boolean) => void;
	onToggleSelectAll?: (ids: number[], checked: boolean) => void;
}

export function PhotographersList({
	photographers,
	onEdit,
	onDelete,
	selectedIds,
	onToggleSelect,
	onToggleSelectAll,
}: PhotographersListProps) {
	const columns: Column<Photographer>[] = [
		{
			key: "title",
			header: "Name",
			render: (p) => (
				<div className="flex items-center">
					<h3 className="font-semibold text-foreground line-clamp-2">
						{p.title}
					</h3>
				</div>
			),
		},
		{
			key: "creator",
			header: "Creator",
			width: "w-32",
			render: () => <span className="text-sm text-muted-foreground">—</span>,
		},
		{
			key: "date",
			header: "Date",
			width: "w-44",
			render: (p) => renderDateColumn("Last Modified", p.updatedAt),
		},
	];

	const actions: Action<Photographer>[] = [];
	if (onEdit) {
		actions.push({
			label: "Edit",
			onClick: onEdit,
		});
	}
	if (onDelete) {
		actions.push({
			label: "Delete",
			onClick: onDelete,
			className: "text-destructive hover:underline",
		});
	}

	return (
		<DataList
			data={photographers}
			columns={columns}
			actions={actions.length > 0 ? actions : undefined}
			getItemId={(p) => p.id}
			getItemTitle={(p) => p.title}
			onTitleClick={onEdit}
			selectedIds={selectedIds}
			onToggleSelect={onToggleSelect}
			onToggleSelectAll={onToggleSelectAll}
			emptyMessage="No photographers found"
		/>
	);
}
