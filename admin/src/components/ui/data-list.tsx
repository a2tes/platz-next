"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDotsVertical } from "@tabler/icons-react";

export interface Column<T> {
	key: string;
	header: string;
	width?: string;
	render: (item: T) => React.ReactNode;
	hideOnMobile?: boolean;
}

export interface Action<T> {
	label: string | ((item: T) => string);
	onClick: (item: T) => void;
	className?: string;
	show?: (item: T) => boolean;
}

interface DataListProps<T> {
	data: T[];
	columns: Column<T>[];
	actions?: Action<T>[];
	getItemId: (item: T) => number;
	getItemTitle?: (item: T) => string;
	onTitleClick?: (item: T) => void;

	// Bulk selection
	selectedIds?: Set<number>;
	onToggleSelect?: (id: number, checked: boolean) => void;
	onToggleSelectAll?: (ids: number[], checked: boolean) => void;

	emptyMessage?: string;
}

export function DataList<T>({
	data,
	columns,
	actions,
	getItemId,
	getItemTitle,
	onTitleClick,
	selectedIds,
	onToggleSelect,
	onToggleSelectAll,
	emptyMessage = "No items found",
}: DataListProps<T>) {
	if (data.length === 0) {
		return <div className="border rounded-lg px-4 py-8 text-center text-muted-foreground">{emptyMessage}</div>;
	}

	// Desktop table view
	const TableView = () => (
		<div className="border rounded-lg overflow-hidden overflow-x-auto scrollbar-hide hidden md:block">
			<table className="w-full">
				<thead>
					<tr className="bg-muted/50 border-b">
						{onToggleSelectAll && (
							<th className="px-4 py-3 w-8">
								{(() => {
									const allSelected = selectedIds
										? data.length > 0 && data.every((item) => selectedIds.has(getItemId(item)))
										: false;
									const someSelected = selectedIds ? data.some((item) => selectedIds.has(getItemId(item))) : false;
									const checked = allSelected ? true : someSelected ? ("indeterminate" as const) : false;

									return (
										<Checkbox
											aria-label="Select all"
											checked={checked}
											onCheckedChange={(value) => onToggleSelectAll(data.map(getItemId), Boolean(value))}
											className="h-4 w-4"
										/>
									);
								})()}
							</th>
						)}
						{columns.map((column) => (
							<th key={column.key} className={`px-4 py-3 text-left text-sm font-semibold ${column.width || ""}`}>
								{column.header}
							</th>
						))}
					</tr>
				</thead>

				<tbody>
					{data.map((item, i) => {
						const itemId = getItemId(item);

						return (
							<tr
								key={itemId}
								className={`${i + 1 !== data.length ? "border-b" : ""} hover:bg-muted/30 transition-colors group`}
							>
								{onToggleSelect && (
									<td className="px-4 py-3 align-top">
										<Checkbox
											aria-label={`Select ${getItemTitle?.(item) || "item"}`}
											checked={selectedIds ? selectedIds.has(itemId) : false}
											onCheckedChange={(value) => onToggleSelect(itemId, Boolean(value))}
											className="h-4 w-4 mt-1"
										/>
									</td>
								)}

								{columns.map((column, index) => (
									<td key={column.key} className="px-4 py-3">
										{index === 0 && (onTitleClick || actions) ? (
											<div className="space-y-2">
												{onTitleClick ? (
													<button
														onClick={() => onTitleClick(item)}
														className="flex items-center text-left w-full cursor-pointer"
													>
														<div className="group-hover:text-primary transition-colors">{column.render(item)}</div>
													</button>
												) : (
													column.render(item)
												)}

												{actions && actions.length > 0 && (
													<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm">
														{(() => {
															const visibleActions = actions.filter((action) => !action.show || action.show(item));
															return visibleActions.map((action, visibleIndex) => (
																<React.Fragment key={visibleIndex}>
																	{visibleIndex > 0 && <span className="text-muted-foreground">|</span>}
																	<button
																		onClick={() => action.onClick(item)}
																		className={`cursor-pointer ${action.className || "text-primary hover:underline"}`}
																	>
																		{typeof action.label === "function" ? action.label(item) : action.label}
																	</button>
																</React.Fragment>
															));
														})()}
													</div>
												)}
											</div>
										) : (
											column.render(item)
										)}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);

	// Mobile card view
	const CardView = () => (
		<div className="space-y-3 md:hidden border rounded-lg">
			{data.map((item) => {
				const itemId = getItemId(item);
				const firstColumn = columns[0];

				return (
					<div key={itemId} className="border-b last:border-0 p-4 hover:bg-muted/30 transition-colors">
						<div className="flex items-start gap-3">
							{onToggleSelect && (
								<Checkbox
									aria-label={`Select ${getItemTitle?.(item) || "item"}`}
									checked={selectedIds ? selectedIds.has(itemId) : false}
									onCheckedChange={(value) => onToggleSelect(itemId, Boolean(value))}
									className="h-4 w-4 mt-1 shrink-0"
								/>
							)}

							<div className="flex-1 min-w-0">
								{/* Title / First column */}
								<div>
									{onTitleClick ? (
										<button onClick={() => onTitleClick(item)} className="text-left w-full">
											<div className="font-medium text-primary">{firstColumn.render(item)}</div>
										</button>
									) : (
										<div className="font-medium">{firstColumn.render(item)}</div>
									)}
								</div>
							</div>

							{/* Actions Dropdown */}
							{actions && actions.length > 0 && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
											<IconDotsVertical className="h-4 w-4" />
											<span className="sr-only">Actions</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{(() => {
											const visibleActions = actions.filter((action) => !action.show || action.show(item));
											return visibleActions.map((action, visibleIndex) => (
												<DropdownMenuItem
													key={visibleIndex}
													onClick={() => action.onClick(item)}
													className={action.className}
												>
													{typeof action.label === "function" ? action.label(item) : action.label}
												</DropdownMenuItem>
											));
										})()}
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);

	return (
		<>
			<TableView />
			<CardView />
		</>
	);
}

// Utility functions
export function formatDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
		hour12: false,
	}).format(d);
}

export function renderDateColumn(label: string, date: Date | string) {
	return (
		<div className="text-sm text-muted-foreground">
			<div>{label}</div>
			<div>{formatDate(date)}</div>
		</div>
	);
}
