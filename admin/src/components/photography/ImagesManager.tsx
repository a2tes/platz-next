"use client";

import * as React from "react";
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	DragOverlay,
	DragStartEvent,
	DragOverEvent,
	DragEndEvent,
	useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PhotographyItemsService, PhotographyItem } from "@/services/photographyItemsService";
import { PhotographyService } from "@/services/photographyService";
import { taxonomyServices } from "@/services/taxonomyService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { ImageItemCard, ImageItemCardMode, Option } from "./ImageItemCard";
import { PhotographyItemEditModal } from "./PhotographyModal";
import { BulkAddPhotographyModal, BulkAddValues, FileWithTitle } from "./BulkAddPhotographyModal";
import { toast } from "sonner";
import { MediaFile } from "@/services/mediaService";
import { IconChevronDown, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function SortableWrapper({
	id,
	children,
}: {
	id: number;
	children: (props: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};
	return (
		<div ref={setNodeRef} style={style} {...attributes}>
			{children((listeners as unknown as React.HTMLAttributes<HTMLDivElement>) || {})}
		</div>
	);
}

function DroppableGroup({ groupId, children }: { groupId: string; children: React.ReactNode }) {
	const { setNodeRef, isOver } = useDroppable({ id: groupId });
	return (
		<div ref={setNodeRef} className={`min-h-[40px] rounded transition-colors ${isOver ? "bg-primary/5" : ""}`}>
			{children}
		</div>
	);
}

type LocalItem = PhotographyItem & { __temp?: boolean };

interface ClientGroup {
	clientId: number | null;
	clientName: string;
	items: LocalItem[];
}

function groupItemsByClient(items: LocalItem[]): ClientGroup[] {
	const uncategorized: LocalItem[] = [];
	const map = new Map<number, { name: string; items: LocalItem[] }>();

	for (const item of items) {
		const clientTaxonomy = item.taxonomies?.find((t) => t.taxonomy?.type === "CLIENT")?.taxonomy;
		if (!clientTaxonomy) {
			uncategorized.push(item);
		} else {
			const existing = map.get(clientTaxonomy.id);
			if (existing) {
				existing.items.push(item);
			} else {
				map.set(clientTaxonomy.id, { name: clientTaxonomy.name, items: [item] });
			}
		}
	}

	// Client groups sorted by their first item's sortOrder
	const groups: ClientGroup[] = Array.from(map.entries())
		.map(([clientId, { name, items }]) => ({ clientId, clientName: name, items }))
		.sort((a, b) => (a.items[0]?.sortOrder ?? 0) - (b.items[0]?.sortOrder ?? 0));
	// Uncategorized always last
	if (uncategorized.length > 0) {
		groups.push({ clientId: null, clientName: "Uncategorized", items: uncategorized });
	}

	return groups;
}

function getGroupId(clientId: number | null): string {
	return clientId === null ? "group-uncategorized" : `group-${clientId}`;
}

export function ImagesManager({
	parentType,
	parentId,
	onStatsChange,
}: {
	parentType: ImageItemCardMode; // "photographer" | "category"
	parentId: number;
	onStatsChange?: (stats: { total: number; active: number }) => void;
}) {
	const queryClient = useQueryClient();
	const {} = useMediaLibraryStore();

	const listQueryKey = ["photography-items", parentType, parentId];

	const { data, isLoading } = useQuery({
		queryKey: listQueryKey,
		queryFn: () =>
			parentType === "photographer"
				? PhotographyItemsService.listByPhotographer(parentId)
				: PhotographyItemsService.listByCategory(parentId),
		staleTime: 1000 * 10,
	});

	// Options for select (categories or photographers)
	const { data: categoriesData } = useQuery({
		queryKey: ["taxonomies", "photo-categories", "all"],
		queryFn: async () => {
			const res = await taxonomyServices["photo-categories"].getAll({ limit: 100 });
			return { data: res.taxonomies.map((t) => ({ id: t.id, title: t.name, slug: t.slug })) };
		},
		staleTime: 1000 * 60,
	});
	const { data: photographersData } = useQuery({
		queryKey: ["photographers", "all"],
		queryFn: () => PhotographyService.getPhotographers({ page: 1, limit: 25 }),
		staleTime: 1000 * 60,
	});

	const categoryOptions: Option[] = (categoriesData?.data || []).map((c) => ({
		label: c.title,
		value: String(c.id),
	}));
	const photographerOptions: Option[] = (photographersData?.data || []).map((p) => ({
		label: p.title,
		value: String(p.id),
	}));

	const [localItems, setLocalItems] = React.useState<LocalItem[]>([]);
	React.useEffect(() => setLocalItems((data?.data as LocalItem[]) || []), [data?.data]);

	const lastStatsRef = React.useRef<{ total: number; active: number } | null>(null);
	React.useEffect(() => {
		if (!onStatsChange) return;
		const persisted = localItems.filter((item) => !item.__temp);
		const stats = {
			total: persisted.length,
			active: persisted.filter((item) => item.status === "PUBLISHED").length,
		};
		const last = lastStatsRef.current;
		if (!last || last.total !== stats.total || last.active !== stats.active) {
			lastStatsRef.current = stats;
			onStatsChange(stats);
		}
	}, [localItems, onStatsChange]);

	const updateMutation = useMutation({
		mutationFn: (payload: { id: number; patch: Partial<PhotographyItem> }) =>
			PhotographyItemsService.updateItem(payload.id, payload.patch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: listQueryKey });
			toast.success("Saved");
		},
		onError: (e: unknown) => {
			const msg = e instanceof Error ? e.message : "Save failed";
			toast.error(msg);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => PhotographyItemsService.deleteItem(id),
		onSuccess: (_, id) => {
			setLocalItems((prev) => prev.filter((p) => p.id !== id));
			queryClient.invalidateQueries({ queryKey: listQueryKey });
			toast.success("Removed");
		},
		onError: (e: unknown) => {
			const msg = e instanceof Error ? e.message : "Remove failed";
			toast.error(msg);
		},
	});

	const reorderMutation = useMutation({
		mutationFn: (orderedIds: number[]) => PhotographyItemsService.reorder({ parentType, parentId, orderedIds }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: listQueryKey }),
		onError: () => toast.error("Reorder failed"),
	});

	const moveToClientMutation = useMutation({
		mutationFn: (payload: { itemId: number; clientId: number | null }) =>
			PhotographyItemsService.moveToClient(payload.itemId, payload.clientId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: listQueryKey }),
		onError: () => toast.error("Move failed"),
	});

	const reorderGroupsMutation = useMutation({
		mutationFn: (groupOrder: { clientId: number | null; itemIds: number[] }[]) =>
			PhotographyItemsService.reorderGroups(parentId, groupOrder),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: listQueryKey }),
		onError: () => toast.error("Reorder failed"),
	});

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
	const [activeItem, setActiveItem] = React.useState<LocalItem | null>(null);
	const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set());

	const isGrouped = parentType === "photographer";
	const groups = React.useMemo(() => (isGrouped ? groupItemsByClient(localItems) : []), [isGrouped, localItems]);

	// Reset open groups when parent changes
	React.useEffect(() => {
		setOpenGroups(new Set());
	}, [parentId]);

	const toggleGroup = (groupId: string) => {
		setOpenGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) next.delete(groupId);
			else next.add(groupId);
			return next;
		});
	};

	const moveGroup = (groupIndex: number, direction: "up" | "down") => {
		const targetIndex = direction === "up" ? groupIndex - 1 : groupIndex + 1;
		// Prevent swapping with the pinned Uncategorized group at the end
		const lastClientIndex = groups.findIndex((g) => g.clientId === null) - 1;
		const maxIndex = lastClientIndex >= 0 ? lastClientIndex : groups.length - 1;
		if (targetIndex < 0 || targetIndex > maxIndex) return;
		const reordered = arrayMove(groups, groupIndex, targetIndex);
		setLocalItems(reordered.flatMap((g) => g.items));
		reorderGroupsMutation.mutate(reordered.map((g) => ({ clientId: g.clientId, itemIds: g.items.map((i) => i.id) })));
	};

	const findGroupForItem = (itemId: number | string): ClientGroup | undefined => {
		return groups.find((g) => g.items.some((i) => i.id === itemId));
	};

	const handleDragStart = (event: DragStartEvent) => {
		const item = localItems.find((i) => i.id === event.active.id);
		setActiveItem(item || null);
	};

	const handleDragOver = (_event: DragOverEvent) => {
		// Could add visual feedback here in the future
	};

	const handleGroupedDragEnd = (event: DragEndEvent) => {
		setActiveItem(null);
		const { active, over } = event;
		if (!over) return;

		const activeId = active.id as number;
		const overId = over.id;

		// Find which group the dragged item came from
		const sourceGroup = findGroupForItem(activeId);
		if (!sourceGroup) return;

		// Determine the target group
		let targetGroup: ClientGroup | undefined;
		let overItemId: number | undefined;

		// Check if over is a group droppable
		const overIdStr = String(overId);
		if (overIdStr.startsWith("group-")) {
			targetGroup = groups.find((g) => getGroupId(g.clientId) === overIdStr);
		} else {
			// Over is an item
			targetGroup = findGroupForItem(overId as number);
			overItemId = overId as number;
		}

		if (!targetGroup) return;

		const sameGroup = sourceGroup.clientId === targetGroup.clientId;

		if (sameGroup) {
			// Reorder within the same group
			if (!overItemId || activeId === overItemId) return;
			const oldIndex = sourceGroup.items.findIndex((i) => i.id === activeId);
			const newIndex = sourceGroup.items.findIndex((i) => i.id === overItemId);
			if (oldIndex === -1 || newIndex === -1) return;
			const newGroupItems = arrayMove(sourceGroup.items, oldIndex, newIndex);

			// Build updated groups and persist
			const updatedGroups = groups.map((g) =>
				g.clientId === sourceGroup.clientId ? { ...g, items: newGroupItems } : g,
			);
			setLocalItems(updatedGroups.flatMap((g) => g.items));
			reorderGroupsMutation.mutate(
				updatedGroups.map((g) => ({ clientId: g.clientId, itemIds: g.items.map((i) => i.id) })),
			);
		} else {
			// Cross-group move
			const movedItem = sourceGroup.items.find((i) => i.id === activeId)!;
			const newSourceItems = sourceGroup.items.filter((i) => i.id !== activeId);

			// Update client taxonomy on moved item locally
			const nonClientTaxonomies = (movedItem.taxonomies || []).filter((t) => t.taxonomy?.type !== "CLIENT");
			const updatedMovedItem: LocalItem = {
				...movedItem,
				taxonomies: targetGroup.clientId
					? [
							...nonClientTaxonomies,
							{
								photographyId: movedItem.id,
								taxonomyId: targetGroup.clientId,
								taxonomy: { id: targetGroup.clientId, type: "CLIENT", name: targetGroup.clientName, slug: "" },
							},
						]
					: nonClientTaxonomies,
			};

			let newTargetItems: LocalItem[];
			if (overItemId) {
				const overIndex = targetGroup.items.findIndex((i) => i.id === overItemId);
				newTargetItems = [...targetGroup.items];
				newTargetItems.splice(overIndex, 0, updatedMovedItem);
			} else {
				newTargetItems = [...targetGroup.items, updatedMovedItem];
			}

			const updatedGroups = groups
				.map((g) => {
					if (g.clientId === sourceGroup.clientId) return { ...g, items: newSourceItems };
					if (g.clientId === targetGroup!.clientId) return { ...g, items: newTargetItems };
					return g;
				})
				.filter((g) => g.items.length > 0);

			// If target group was empty/new and we need to add uncategorized
			setLocalItems(updatedGroups.flatMap((g) => g.items));

			// First move the item's client, then reorder all groups
			moveToClientMutation.mutate(
				{ itemId: activeId, clientId: targetGroup.clientId },
				{
					onSuccess: () => {
						reorderGroupsMutation.mutate(
							updatedGroups.map((g) => ({ clientId: g.clientId, itemIds: g.items.map((i) => i.id) })),
						);
					},
				},
			);
		}
	};

	const handleFlatDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = localItems.findIndex((i) => i.id === active.id);
		const newIndex = localItems.findIndex((i) => i.id === over.id);
		const newItems = arrayMove(localItems, oldIndex, newIndex);
		setLocalItems(newItems);
		reorderMutation.mutate(newItems.map((i) => i.id));
	};

	// Bulk add state
	const [bulkAddOpen, setBulkAddOpen] = React.useState(false);
	const [bulkAddFiles, setBulkAddFiles] = React.useState<MediaFile[]>([]);

	const handleAddImages = () => {
		// Open media library modal for multi-select with callback
		const { openMultiSelectorModal } = useMediaLibraryStore.getState();
		openMultiSelectorModal("image", handleSelected);
	};

	// Handle multi-select from MediaLibraryModal
	const handleSelected = async (files: MediaFile[]) => {
		if (files.length === 0) return;

		if (files.length === 1) {
			// Single file - use existing flow with edit modal
			const file = files[0];
			const temp: LocalItem = {
				id: -Math.floor(Math.random() * 1_000_000),
				__temp: true,
				title: "",
				slug: "",
				description: "",
				imageId: file.id,
				image: file,
				photographerId: parentType === "photographer" ? parentId : 0,
				categoryId: parentType === "category" ? parentId : 0,
				client: "",
				year: undefined,
				location: "",
				sortOrder: (localItems[localItems.length - 1]?.sortOrder ?? 0) + 1,
				status: "DRAFT",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			setEditItem(temp);
		} else {
			// Multiple files - open bulk add modal
			setBulkAddFiles(files);
			setBulkAddOpen(true);
		}
	};

	const [editItem, setEditItem] = React.useState<LocalItem | null>(null);
	const [deleteItem, setDeleteItem] = React.useState<LocalItem | null>(null);

	// Handle bulk add submit
	const handleBulkAddSubmit = async (filesWithTitles: FileWithTitle[], commonValues: BulkAddValues) => {
		const items = filesWithTitles.map((item) => ({
			imageId: item.file.id,
			title: item.title.trim() || "Untitled",
			description: "",
			year: commonValues.year ?? undefined,
			location: commonValues.location || "",
			// Use per-file categoryIds as taxonomyIds if set
			taxonomyIds:
				parentType === "photographer" ? (item.categoryIds?.length ? item.categoryIds : undefined) : undefined,
			photographerId: parentType === "category" ? (item.photographerId ?? commonValues.photographerId) : parentId,
		}));

		try {
			const createdItems = await PhotographyItemsService.bulkCreate({
				photographerId: parentType === "photographer" ? parentId : undefined,
				taxonomyIds: [...(parentType === "category" ? [parentId] : []), ...(commonValues.taxonomyIds || [])],
				items,
			});

			// Add to local items
			setLocalItems((prev) => [...prev, ...(createdItems as LocalItem[])]);
			await queryClient.invalidateQueries({ queryKey: listQueryKey });
			toast.success(`${createdItems.length} images added successfully`);
			setBulkAddOpen(false);
			setBulkAddFiles([]);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Bulk create failed";
			toast.error(msg);
		}
	};

	if (isLoading) return <Skeleton className="h-40 w-full" />;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="text-sm text-muted-foreground">
					{localItems.length} item{localItems.length !== 1 ? "s" : ""}
				</div>
				<div className="flex gap-2">
					<Button onClick={handleAddImages} size="sm">
						Add image(s)
					</Button>
				</div>
			</div>
			{localItems.length > 0 && <Separator />}

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={isGrouped ? handleDragStart : undefined}
				onDragOver={isGrouped ? handleDragOver : undefined}
				onDragEnd={isGrouped ? handleGroupedDragEnd : handleFlatDragEnd}
			>
				{isGrouped ? (
					<div className="space-y-2">
						{groups.map((group, groupIndex) => {
							const groupId = getGroupId(group.clientId);
							const isOpen = openGroups.has(groupId);
							const hasArrows = groups.filter((g) => g.clientId !== null).length > 1;
							return (
								<Collapsible key={groupId} open={isOpen} onOpenChange={() => toggleGroup(groupId)}>
									<div className="flex items-center gap-1">
										{hasArrows && group.clientId !== null && (
											<div className="flex flex-col">
												<button
													type="button"
													className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
													disabled={groupIndex === 0}
													onClick={(e) => {
														e.stopPropagation();
														moveGroup(groupIndex, "up");
													}}
													title="Move group up"
												>
													<IconArrowUp className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
													disabled={groupIndex >= groups.filter((g) => g.clientId !== null).length - 1}
													onClick={(e) => {
														e.stopPropagation();
														moveGroup(groupIndex, "down");
													}}
													title="Move group down"
												>
													<IconArrowDown className="h-3.5 w-3.5" />
												</button>
											</div>
										)}
										{hasArrows && group.clientId === null && <div className="w-[18px] shrink-0" />}
										<CollapsibleTrigger asChild>
											<button className="flex flex-1 items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
												<IconChevronDown
													className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
												/>
												<span>{group.clientName}</span>
												<span className="ml-auto text-xs text-muted-foreground">
													{group.items.length} item{group.items.length !== 1 ? "s" : ""}
												</span>
											</button>
										</CollapsibleTrigger>
									</div>
									<CollapsibleContent>
										<div className={hasArrows ? "ml-[22px]" : ""}>
											<DroppableGroup groupId={groupId}>
												<SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
													<div className="space-y-3 pt-2 pb-1">
														{group.items.map((it) => (
															<SortableWrapper key={it.id} id={it.id}>
																{(dragProps) => (
																	<ImageItemCard
																		item={it}
																		mode={parentType}
																		options={parentType === "photographer" ? categoryOptions : photographerOptions}
																		dragHandleProps={dragProps}
																		onEdit={() => setEditItem(it)}
																		onTogglePublish={() => {
																			const next = it.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
																			setLocalItems((prev) =>
																				prev.map((p) => (p.id === it.id ? { ...p, status: next } : p)),
																			);
																			updateMutation.mutate({ id: it.id, patch: { status: next } });
																		}}
																		onDelete={() => {
																			if (it.__temp) {
																				setLocalItems((prev) => prev.filter((p) => p.id !== it.id));
																				return;
																			}
																			setDeleteItem(it);
																		}}
																	/>
																)}
															</SortableWrapper>
														))}
													</div>
												</SortableContext>
											</DroppableGroup>
										</div>
									</CollapsibleContent>
								</Collapsible>
							);
						})}
						{groups.length === 0 && (
							<div className="py-6 text-center text-sm text-muted-foreground">No images yet.</div>
						)}
					</div>
				) : (
					<SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
						<div className="space-y-3">
							{localItems.map((it) => (
								<SortableWrapper key={it.id} id={it.id}>
									{(dragProps) => (
										<ImageItemCard
											item={it}
											mode={parentType}
											options={photographerOptions}
											dragHandleProps={dragProps}
											onEdit={() => setEditItem(it)}
											onTogglePublish={() => {
												const next = it.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
												setLocalItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: next } : p)));
												updateMutation.mutate({ id: it.id, patch: { status: next } });
											}}
											onDelete={() => {
												if (it.__temp) {
													setLocalItems((prev) => prev.filter((p) => p.id !== it.id));
													return;
												}
												setDeleteItem(it);
											}}
										/>
									)}
								</SortableWrapper>
							))}
						</div>
					</SortableContext>
				)}

				{/* Drag overlay for cross-container visual feedback */}
				{isGrouped && (
					<DragOverlay>
						{activeItem ? (
							<div className="opacity-80">
								<ImageItemCard
									item={activeItem}
									mode={parentType}
									options={parentType === "photographer" ? categoryOptions : photographerOptions}
									dragHandleProps={{}}
									onEdit={() => {}}
									onTogglePublish={() => {}}
									onDelete={() => {}}
								/>
							</div>
						) : null}
					</DragOverlay>
				)}
			</DndContext>

			{/* Edit modal */}
			{editItem && (
				<PhotographyItemEditModal
					open={!!editItem}
					onOpenChange={(open) => setEditItem(open ? editItem : null)}
					item={editItem}
					mode={parentType}
					options={parentType === "photographer" ? categoryOptions : photographerOptions}
					onSubmit={async (vals) => {
						if (editItem.__temp) {
							// Validate minimal fields depending on parentType
							const hasTitle = !!vals.title?.trim();
							const hasCategory =
								parentType === "photographer" ? !!(vals.taxonomyIds && vals.taxonomyIds.length > 0) : true;
							const hasPhotographer = parentType === "category" ? !!vals.photographerId : true;
							const parsedYear =
								typeof vals.year === "number" && !Number.isNaN(vals.year) ? vals.year : Number(vals.year);
							const hasYear = Number.isFinite(parsedYear);
							if (!hasTitle || !hasCategory || !hasPhotographer) {
								toast.error("Please fill title and select the required fields before saving.");
								return;
							}
							// if (!hasYear) {
							// 	toast.error("Please enter a valid year before saving.");
							// 	return;
							// }
							try {
								const created = await PhotographyItemsService.createItem({
									title: vals.title,
									description: vals.description || "",
									imageId: editItem.imageId,
									photographerId: parentType === "photographer" ? parentId : (vals.photographerId as number),
									categoryId: parentType === "category" ? parentId : (vals.taxonomyIds?.[0] as number),
									client: vals.client || "",

									year: parsedYear,
									location: vals.location || "",
									status: "PUBLISHED",
								});
								// Append to list now that user saved
								setLocalItems((prev) => [...prev, created as LocalItem]);
								await queryClient.invalidateQueries({ queryKey: listQueryKey });
								toast.success("Created");
							} catch (e: unknown) {
								const msg = e instanceof Error ? e.message : "Create failed";
								toast.error(msg);
							}
						} else {
							try {
								// optimistic update
								setLocalItems((prev) => prev.map((p) => (p.id === editItem.id ? ({ ...p, ...vals } as LocalItem) : p)));
								await updateMutation.mutateAsync({
									id: editItem.id,
									patch: { ...vals },
								});
							} catch (e: unknown) {
								const msg = e instanceof Error ? e.message : "Save failed";
								toast.error(msg);
							}
						}
					}}
				/>
			)}

			{/* Delete confirmation dialog */}
			<AlertDialog open={!!deleteItem} onOpenChange={(open) => setDeleteItem(open ? deleteItem : null)}>
				{deleteItem && (
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete image item?</AlertDialogTitle>
						</AlertDialogHeader>
						<AlertDialogDescription>
							This will remove
							<span className="mx-1 font-medium">
								{deleteItem.title || deleteItem.image?.originalName || "Untitled"}
							</span>
							from the list. You can’t undo this action.
						</AlertDialogDescription>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									deleteMutation.mutate(deleteItem.id);
									setDeleteItem(null);
								}}
								className="bg-destructive text-white hover:bg-destructive/90"
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				)}
			</AlertDialog>

			{/* Bulk add modal */}
			<BulkAddPhotographyModal
				open={bulkAddOpen}
				onOpenChange={setBulkAddOpen}
				files={bulkAddFiles}
				mode={parentType}
				options={parentType === "photographer" ? categoryOptions : photographerOptions}
				onSubmit={handleBulkAddSubmit}
				onRemoveFile={(fileId) => setBulkAddFiles((prev) => prev.filter((f) => f.id !== fileId))}
			/>
		</div>
	);
}
