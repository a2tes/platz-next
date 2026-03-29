"use client";

import * as React from "react";
import Image from "next/image";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorksService, Director } from "@/services/worksService";
import { HomepageService } from "@/services/homepageService";
import type { HomepageDirectorRow } from "@/services/homepageService";
import { VideoSettingsModal } from "@/components/blocks/VideoSettingsModal";
import {
	IconGripVertical,
	IconPhoto,
	IconPlus,
	IconSearch,
	IconTrash,
	IconScissors,
	IconX,
	IconChevronRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SeoButton } from "@/components/settings/SeoButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function HomepagePage() {
	const [showAddModal, setShowAddModal] = React.useState(false);

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<Header onAddWork={() => setShowAddModal(true)} />
					<Content showAddModal={showAddModal} setShowAddModal={setShowAddModal} />
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}

function Header({ onAddWork }: { onAddWork: () => void }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-3xl font-bold">Homepage</h1>
					<div className="text-sm text-muted-foreground mt-1">Manage homepage works selections. Drag to reorder.</div>
				</div>
				<div className="flex items-center gap-2">
					<Button onClick={onAddWork}>
						<IconPlus className="h-4 w-4 mr-2" />
						Add Work
					</Button>
					<SeoButton pageKey="homepage" pageTitle="Homepage" />
				</div>
			</div>
		</div>
	);
}

function Content({
	showAddModal,
	setShowAddModal,
}: {
	showAddModal: boolean;
	setShowAddModal: (open: boolean) => void;
}) {
	const qc = useQueryClient();
	const [editingItem, setEditingItem] = React.useState<HomepageDirectorRow | null>(null);

	const { data: selections, isLoading } = useQuery({
		queryKey: ["homepage-selections"],
		queryFn: () => HomepageService.getSelections(),
		staleTime: 1000 * 30,
		refetchInterval: (query) => {
			const rows = query.state.data;
			if (rows?.some((r) => r.clipJob && r.clipJob.status !== "COMPLETED" && r.clipJob.status !== "FAILED")) {
				return 5000;
			}
			return false;
		},
	});

	const items = selections ?? [];

	const removeMutation = useMutation({
		mutationFn: (id: number) => HomepageService.removeSelection(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["homepage-selections"] });
		},
	});

	const processClipMutation = useMutation({
		mutationFn: ({
			selectionId,
			cropSettings,
			trimSettings,
		}: {
			selectionId: number;
			cropSettings?: { x: number; y: number; width: number; height: number; aspect: number; aspectLabel?: string };
			trimSettings?: { startTime: number; endTime: number };
		}) => HomepageService.processClip(selectionId, { cropSettings, trimSettings }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["homepage-selections"] });
			setEditingItem(null);
		},
	});

	const assignClipMutation = useMutation({
		mutationFn: ({ selectionId, clipJobId }: { selectionId: number; clipJobId: string }) =>
			HomepageService.updateVideoSource(selectionId, "clip", clipJobId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["homepage-selections"] });
			setEditingItem(null);
		},
	});

	const editingVideoUrl = React.useMemo(() => {
		if (!editingItem?.work?.videoFile?.video) return null;
		const v = editingItem.work.videoFile.video;
		return v.mp4 || v.hls || v.default || null;
	}, [editingItem]);

	return (
		<div className="space-y-4">
			{isLoading ? (
				<div className="space-y-2">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : items.length === 0 ? (
				<div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
					<p className="text-sm">No works on the homepage yet.</p>
					<Button variant="outline" className="mt-4" onClick={() => setShowAddModal(true)}>
						<IconPlus className="h-4 w-4 mr-2" />
						Add Work
					</Button>
				</div>
			) : (
				<SortableList items={items} onEdit={setEditingItem} onRemove={(id) => removeMutation.mutate(id)} />
			)}

			<AddWorkModal open={showAddModal} onOpenChange={setShowAddModal} />

			{editingItem && editingVideoUrl && (
				<VideoSettingsModal
					mode="clip"
					mediaUrl={editingVideoUrl}
					cropSettings={editingItem.clipJob?.cropSettings ?? undefined}
					trimSettings={editingItem.clipJob?.trimSettings ?? undefined}
					sourceMediaId={editingItem.work?.videoFileId ?? undefined}
					onCancel={() => setEditingItem(null)}
					onSave={(settings) => {
						processClipMutation.mutate({
							selectionId: editingItem.id,
							...settings,
						});
					}}
					onSelectExistingClip={(clip) => {
						assignClipMutation.mutate({
							selectionId: editingItem.id,
							clipJobId: clip.id,
						});
					}}
				/>
			)}
		</div>
	);
}

/* ─── Sortable List ─── */

function SortableList({
	items,
	onEdit,
	onRemove,
}: {
	items: HomepageDirectorRow[];
	onEdit: (item: HomepageDirectorRow) => void;
	onRemove: (id: number) => void;
}) {
	const qc = useQueryClient();
	const [local, setLocal] = React.useState(items);
	React.useEffect(() => setLocal(items), [items]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const onDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = local.findIndex((i) => i.id === active.id);
		const newIndex = local.findIndex((i) => i.id === over.id);
		const newItems = arrayMove(local, oldIndex, newIndex);
		setLocal(newItems);

		const itemIds = newItems.map((i) => i.id);

		// Optimistic update
		qc.setQueryData<HomepageDirectorRow[] | undefined>(["homepage-selections"], () =>
			newItems.map((item, idx) => ({ ...item, sortOrder: idx + 1 })),
		);

		HomepageService.reorder(itemIds).catch(() => {
			qc.invalidateQueries({ queryKey: ["homepage-selections"] });
		});
	};

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={local.map((i) => i.id)} strategy={verticalListSortingStrategy}>
				<div className="space-y-2">
					{local.map((item) => (
						<SortableItem key={item.id} item={item} onEdit={onEdit} onRemove={onRemove} />
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}

function SortableItem({
	item,
	onEdit,
	onRemove,
}: {
	item: HomepageDirectorRow;
	onEdit: (item: HomepageDirectorRow) => void;
	onRemove: (id: number) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const thumbnail =
		item.clipJob?.thumbnailUrl ||
		item.work?.videoFile?.images?.thumbnail ||
		item.work?.videoFile?.images?.original ||
		null;

	const hasVideo = !!(item.work?.videoFile?.video?.mp4 || item.work?.videoFile?.video?.default);

	const clipStatus = item.clipJob?.status;

	return (
		<div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-md border bg-background p-3">
			<button
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
			>
				<IconGripVertical className="h-5 w-5" />
			</button>

			<div className="h-12 w-20 rounded bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
				{thumbnail ? (
					<Image
						src={thumbnail}
						alt={item.work?.title || ""}
						width={80}
						height={48}
						className="h-full w-full object-cover"
						unoptimized
					/>
				) : (
					<IconPhoto className="h-6 w-6 text-muted-foreground" />
				)}
			</div>

			<div className="flex-1 min-w-0">
				<div className="font-medium text-sm truncate">{item.work?.title || "Unknown Work"}</div>
				<div className="text-xs text-muted-foreground truncate">{item.director?.title || "Unknown Director"}</div>
			</div>

			{item.videoSource === "clip" && clipStatus && (
				<div
					className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${
						clipStatus === "COMPLETED"
							? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
							: clipStatus === "FAILED"
								? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
								: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
					}`}
				>
					{clipStatus === "COMPLETED" ? "Clip" : clipStatus === "FAILED" ? "Failed" : "Processing"}
				</div>
			)}

			<div className="flex items-center gap-1">
				{hasVideo && (
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)} title="Crop / Trim">
						<IconScissors className="h-4 w-4" />
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:text-destructive"
					onClick={() => onRemove(item.id)}
					title="Remove"
				>
					<IconTrash className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

/* ─── Add Work Modal ─── */

function AddWorkModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const qc = useQueryClient();
	const [step, setStep] = React.useState<"director" | "work">("director");
	const [selectedDirector, setSelectedDirector] = React.useState<{ id: number; title: string } | null>(null);
	const [directorSearch, setDirectorSearch] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");

	React.useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(directorSearch), 250);
		return () => clearTimeout(t);
	}, [directorSearch]);

	// Reset state when modal closes
	React.useEffect(() => {
		if (!open) {
			setStep("director");
			setSelectedDirector(null);
			setDirectorSearch("");
		}
	}, [open]);

	const { data: directorsData, isLoading: loadingDirectors } = useQuery({
		queryKey: ["directors-all", debouncedSearch],
		queryFn: () =>
			WorksService.getDirectors({
				page: 1,
				limit: 50,
				search: debouncedSearch,
				sortBy: "title",
				sortOrder: "asc",
			}),
		enabled: open && step === "director",
		staleTime: 1000 * 30,
	});

	const { data: directorDetail, isLoading: loadingWorks } = useQuery({
		queryKey: ["director", selectedDirector?.id],
		queryFn: () => WorksService.getDirector(selectedDirector!.id),
		enabled: !!selectedDirector,
		staleTime: 1000 * 30,
	});

	// Current homepage selections to check for duplicates
	const { data: currentSelections } = useQuery({
		queryKey: ["homepage-selections"],
		queryFn: () => HomepageService.getSelections(),
		staleTime: 1000 * 30,
	});

	const usedCombinations = React.useMemo(() => {
		const set = new Set<string>();
		(currentSelections ?? []).forEach((s) => set.add(`${s.directorId}-${s.workId}`));
		return set;
	}, [currentSelections]);

	const addMutation = useMutation({
		mutationFn: ({ directorId, workId }: { directorId: number; workId: number }) =>
			HomepageService.addSelection(directorId, workId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["homepage-selections"] });
			onOpenChange(false);
		},
	});

	// Filter: only published directors with at least one published work
	const directors = React.useMemo(() => {
		return (directorsData?.data ?? []).filter(
			(d) => d.status === "PUBLISHED" && d.works && d.works.some((w: any) => w.work?.status === "PUBLISHED"),
		);
	}, [directorsData]);

	const works = React.useMemo(() => {
		return (directorDetail?.works ?? [])
			.filter((w: any) => w.work?.status === "PUBLISHED")
			.map((w: any) => ({
				id: w.work.id,
				title: w.work.title,
				status: w.work.status,
				hasVideo: !!w.work.videoFile,
			}));
	}, [directorDetail]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg max-h-[80vh] gap-4">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle>
							{step === "director" ? "Select Director" : `Select ${selectedDirector?.title}'s Work`}
						</DialogTitle>
						{step === "work" && (
							<Button variant="ghost" size="sm" onClick={() => setStep("director")}>
								Back
							</Button>
						)}
					</div>
				</DialogHeader>

				{step === "director" && (
					<div className="space-y-4">
						<div className="relative">
							<IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search directors..."
								value={directorSearch}
								onChange={(e) => setDirectorSearch(e.target.value)}
								className="pl-9"
								autoFocus
							/>
						</div>
						<div className="max-h-[50vh] overflow-y-auto space-y-1">
							{loadingDirectors ? (
								<div className="space-y-2 p-2">
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-3/4" />
								</div>
							) : directors.length === 0 ? (
								<div className="text-sm text-muted-foreground p-4 text-center">No directors found.</div>
							) : (
								directors.map((d) => (
									<button
										key={d.id}
										onClick={() => {
											setSelectedDirector({ id: d.id, title: d.title });
											setStep("work");
										}}
										className="w-full flex items-center justify-between rounded-md p-3 hover:bg-accent text-left"
									>
										<div className="flex items-center gap-3">
											<div className="h-8 w-8 rounded bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
												{d.avatar?.images ? (
													<Image
														src={d.avatar.images.thumbnail || d.avatar.images.original}
														alt={d.title}
														width={32}
														height={32}
														className="h-full w-full object-cover"
														unoptimized
													/>
												) : (
													<IconPhoto className="h-4 w-4 text-muted-foreground" />
												)}
											</div>
											<span className="text-sm font-medium">{d.title}</span>
										</div>
										<IconChevronRight className="h-4 w-4 text-muted-foreground" />
									</button>
								))
							)}
						</div>
					</div>
				)}

				{step === "work" && (
					<div className="space-y-3">
						<div className="max-h-[50vh] overflow-y-auto space-y-1">
							{loadingWorks ? (
								<div className="space-y-2 p-2">
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
								</div>
							) : works.length === 0 ? (
								<div className="text-sm text-muted-foreground p-4 text-center">No works found for this director.</div>
							) : (
								works.map((w: { id: number; title: string; status: string; hasVideo: boolean }) => {
									const isUsed = usedCombinations.has(`${selectedDirector!.id}-${w.id}`);
									return (
										<button
											key={w.id}
											onClick={() =>
												addMutation.mutate({
													directorId: selectedDirector!.id,
													workId: w.id,
												})
											}
											disabled={isUsed || addMutation.isPending}
											className={`w-full text-left rounded-md p-3 flex items-center justify-between ${
												isUsed ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
											}`}
										>
											<div>
												<div className="text-sm font-medium">{w.title}</div>
												{isUsed && <div className="text-xs text-muted-foreground">Already on homepage</div>}
											</div>
											{isUsed && (
												<span className="text-[10px] uppercase tracking-wide text-muted-foreground">Added</span>
											)}
										</button>
									);
								})
							)}
						</div>
						{addMutation.isError && (
							<div className="text-sm text-destructive">
								{(addMutation.error as any)?.response?.data?.error?.message || "Failed to add work"}
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
