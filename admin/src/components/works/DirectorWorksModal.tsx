"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WorksService, Director, DirectorWorkLink } from "@/services/worksService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconGripVertical, IconPhoto, IconX, IconPencil } from "@tabler/icons-react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

interface DirectorWorksModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	director: Director | null;
}

function SortableRow({
	id,
	children,
}: {
	id: number;
	children: (props: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};
	return (
		<div ref={setNodeRef} style={style} {...attributes}>
			{children((listeners as unknown as React.HTMLAttributes<HTMLDivElement>) || {})}
		</div>
	);
}

export function DirectorWorksModal({ open, onOpenChange, director }: DirectorWorksModalProps) {
	const queryClient = useQueryClient();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const { data, isLoading } = useQuery({
		queryKey: ["director-works", director?.id],
		queryFn: () => WorksService.getDirectorWorks(director!.id),
		enabled: open && !!director?.id,
		staleTime: 1000 * 30,
	});

	const items = React.useMemo(() => data ?? [], [data]);
	const [local, setLocal] = React.useState<DirectorWorkLink[]>(items);
	React.useEffect(() => setLocal(items), [items]);

	const reorderMutation = useMutation({
		mutationFn: (orderedIds: number[]) => WorksService.reorderDirectorWorks(director!.id, orderedIds),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["director-works", director?.id],
			});
			toast.success("Order saved");
		},
		onError: (err: unknown) => {
			const message = err instanceof Error ? err.message : "Failed to reorder";
			toast.error(message);
		},
	});

	const onDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = local.findIndex((l) => l.workId === active.id);
		const newIndex = local.findIndex((l) => l.workId === over.id);
		const next = arrayMove(local, oldIndex, newIndex);
		setLocal(next);
		reorderMutation.mutate(next.map((l) => l.workId));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
				<DialogHeader className="flex flex-row items-center justify-between shrink-0">
					<DialogTitle>Works associated with {director?.title ?? "Director"}</DialogTitle>
					<Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
						<IconX className="h-4 w-4" />
					</Button>
				</DialogHeader>
				<div className="mt-4 min-h-0 flex-1">
					{isLoading ? (
						<div className="space-y-2">
							<div className="h-10 w-full bg-muted animate-pulse rounded" />
							<div className="h-10 w-full bg-muted animate-pulse rounded" />
							<div className="h-10 w-3/4 bg-muted animate-pulse rounded" />
						</div>
					) : items.length === 0 ? (
						<div className="text-sm text-muted-foreground">No works associated with this director yet.</div>
					) : (
						<div className="overflow-y-auto max-h-[60vh]">
							<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
								<SortableContext items={local.map((l) => l.workId)} strategy={verticalListSortingStrategy}>
									<div className="space-y-2 pr-2">
										{local.map((link) => {
											// Get thumbnail from previewImage or videoFile (API now returns proper video thumbnails)
											const media = link.work.previewImage || link.work.videoFile;
											const thumbnailSrc = media?.images?.small || media?.images?.thumbnail || "";

											return (
												<SortableRow key={link.workId} id={link.workId}>
													{(dragProps) => (
														<div
															{...dragProps}
															className="flex items-center gap-4 p-3 border rounded hover:bg-accent cursor-pointer"
														>
															<IconGripVertical className="h-4 w-4 text-muted-foreground" />
															<div className="h-12 w-20 rounded bg-muted overflow-hidden flex items-center justify-center">
																{thumbnailSrc ? (
																	<Image
																		src={thumbnailSrc}
																		alt={link.work.title}
																		width={80}
																		height={60}
																		className="h-full w-full object-cover"
																		unoptimized
																	/>
																) : (
																	<IconPhoto className="h-8 w-8 text-muted-foreground" />
																)}
															</div>
															<div className="flex-1">
																<div className="font-medium">{link.work.title}</div>
																<div className="text-xs text-muted-foreground">
																	{link.work.status === "PUBLISHED" ? "Published" : "Draft"}
																</div>
															</div>
															<Link href={`/works/${link.workId}/edit`} onClick={(e) => e.stopPropagation()}>
																<Button variant="ghost" size="icon" className="h-8 w-8">
																	<IconPencil className="h-4 w-4" />
																</Button>
															</Link>
														</div>
													)}
												</SortableRow>
											);
										})}
									</div>
								</SortableContext>
							</DndContext>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
