"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotographyService } from "@/services/photographyService";
import { taxonomyServices } from "@/services/taxonomyService";
import { ImagesManager } from "@/components/photography/ImagesManager";
import { Separator } from "@/components/ui/separator";
import { createPhotographyNavigation } from "@/lib/entity-list-helpers";
import { IconChevronLeft, IconChevronRight, IconPhoto, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SeoButton } from "@/components/settings/SeoButton";

type TabKey = "photographers" | "categories";

function formatImagesSummary(item: { imagesCount?: number; activeImagesCount?: number }) {
	const total = item.imagesCount ?? 0;
	const active = Math.min(item.activeImagesCount ?? 0, total);
	if (total === 0) return "No images";
	const base = `${total} image${total === 1 ? "" : "s"}`;
	if (active === 0) return base;
	return `${base}, ${active} active`;
}

export default function PhotographyPage() {
	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<Header />
					<Switcher />
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}

function Header() {
	const navigation = createPhotographyNavigation({
		currentPath: "/photography",
	});
	return (
		<div className="space-y-6">
			{/* Sub navigation */}
			<nav className="flex gap-6 border-b">
				{navigation.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
							item.isActive
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						{item.label}
					</Link>
				))}
			</nav>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-3xl font-bold">Photography</h1>
					<div className="text-sm text-muted-foreground mt-1">
						Create, manage and showcase your photography portfolio.
					</div>
				</div>
				<SeoButton pageKey="photography" pageTitle="Photography" />
			</div>
		</div>
	);
}

function Switcher() {
	const [activeTab, setActiveTab] = React.useState<TabKey>("photographers");
	const [search, setSearch] = React.useState("");
	const [debounced, setDebounced] = React.useState("");

	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(search), 250);
		return () => clearTimeout(t);
	}, [search]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
					<TabsList>
						<TabsTrigger value="photographers">Photographers</TabsTrigger>
						<TabsTrigger value="categories">Categories</TabsTrigger>
					</TabsList>
				</Tabs>
				<div className="relative max-w-md w-fit md:w-64">
					<IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder={`Search ${activeTab}...`}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
			</div>

			{activeTab === "photographers" ? <PhotographersList search={debounced} /> : <CategoriesList search={debounced} />}
		</div>
	);
}

function SortableRow({
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
	} as React.CSSProperties;
	return (
		<div ref={setNodeRef} style={style} {...attributes}>
			{children((listeners as unknown as React.HTMLAttributes<HTMLDivElement>) || {})}
		</div>
	);
}

function PhotographersList({ search }: { search: string }) {
	const queryClient = useQueryClient();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const { data, isLoading } = useQuery({
		queryKey: ["photographers-all", search],
		queryFn: () => PhotographyService.getPhotographers({ page: 1, limit: 25, search }),
		staleTime: 1000 * 30,
	});

	const items = React.useMemo(() => data?.data ?? [], [data]);
	const [local, setLocal] = React.useState(items);
	React.useEffect(() => setLocal(items), [items]);

	const reorderMutation = useMutation({
		mutationFn: (orderedIds: number[]) => PhotographyService.reorderPhotographers(orderedIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["photographers-all"] });
		},
	});

	const [selected, setSelected] = React.useState<{
		id: number;
		title: string;
		imagesCount?: number;
		activeImagesCount?: number;
	} | null>(null);

	// Clear selection if it no longer exists in filtered items
	React.useEffect(() => {
		if (selected && !items.find((p) => p.id === selected.id)) {
			setSelected(null);
		}
	}, [items, selected]);

	const handleStatsChange = React.useCallback((photographerId: number, stats: { total: number; active: number }) => {
		setLocal((prev) =>
			prev.map((p) =>
				p.id === photographerId
					? {
							...p,
							imagesCount: stats.total,
							activeImagesCount: stats.active,
						}
					: p,
			),
		);
		setSelected((prev) =>
			prev && prev.id === photographerId
				? {
						...prev,
						imagesCount: stats.total,
						activeImagesCount: stats.active,
					}
				: prev,
		);
	}, []);

	const onDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = local.findIndex((p) => p.id === active.id);
		const newIndex = local.findIndex((p) => p.id === over.id);
		const next = arrayMove(local, oldIndex, newIndex);
		setLocal(next);
		reorderMutation.mutate(next.map((p) => p.id));
	};

	return (
		<div className="grid grid-cols-2 gap-6 relative overflow-hidden md:overflow-visible">
			<div
				className={`col-span-2 md:col-span-1 space-y-2 transition-all absolute w-full ${
					selected ? "-left-full -ml-4" : "left-0"
				} md:relative md:left-0 md:ml-0`}
			>
				{isLoading ? (
					<div className="p-4">
						<Skeleton className="h-6 w-full mb-2" />
						<Skeleton className="h-6 w-3/4 mb-2" />
						<Skeleton className="h-6 w-5/6" />
					</div>
				) : (
					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
						<SortableContext items={local.map((p) => p.id)} strategy={verticalListSortingStrategy}>
							{local.map((p) => (
								<SortableRow key={p.id} id={p.id}>
									{(dragProps) => (
										<div
											{...dragProps}
											onClick={() =>
												setSelected({
													id: p.id,
													title: p.title,
													imagesCount: p.imagesCount,
													activeImagesCount: p.activeImagesCount,
												})
											}
											className={`flex items-center justify-between rounded-md border p-4 hover:bg-accent cursor-pointer ${
												selected?.id === p.id ? "bg-accent" : ""
											}`}
										>
											<div className="flex items-center gap-3">
												<div className="h-12 w-12 rounded bg-muted overflow-hidden inline-flex items-center justify-center">
													{p.avatar?.images ? (
														<Image
															src={p.avatar.images.thumbnail || p.avatar.images.original}
															alt={p.title}
															width={48}
															height={48}
															className="h-full w-full object-cover"
															unoptimized
														/>
													) : (
														<IconPhoto className="h-8 w-8 text-muted-foreground" />
													)}
												</div>
												<div>
													<div className="font-medium">{p.title}</div>
													<div className="text-xs text-muted-foreground">{formatImagesSummary(p)}</div>
												</div>
											</div>
											<IconChevronRight className="h-4 w-4 text-muted-foreground" />
										</div>
									)}
								</SortableRow>
							))}
						</SortableContext>
					</DndContext>
				)}
				{!isLoading && items.length === 0 && (
					<div className="p-6 text-sm text-muted-foreground">No photographers found.</div>
				)}
			</div>
			<div
				className={`col-span-2 md:col-span-1 transition-all absolute w-full ${
					selected ? "left-0" : "left-full ml-4 md:ml-0"
				} md:relative md:left-0`}
			>
				{selected ? (
					<div className="rounded-md border p-4 top-20 sticky">
						<div className="mb-4 flex items-center">
							<Button variant={"ghost"} className="visible md:hidden mr-2" onClick={() => setSelected(null)}>
								<IconChevronLeft className="h-4 w-4" />
							</Button>
							<div className="space-y-1">
								<h2 className="text-xl font-semibold">{selected.title}</h2>
								<div className="text-sm text-muted-foreground">Manage images for this photographer</div>
							</div>
						</div>
						<Separator className="mb-4" />
						<ImagesManager
							parentType="photographer"
							parentId={selected.id}
							onStatsChange={(stats) => handleStatsChange(selected.id, stats)}
						/>
					</div>
				) : (
					<div className="rounded-md border p-6 text-sm text-muted-foreground top-20 sticky">
						Select a photographer to manage images.
					</div>
				)}
			</div>
		</div>
	);
}

function CategoriesList({ search }: { search: string }) {
	const queryClient = useQueryClient();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const { data, isLoading } = useQuery({
		queryKey: ["taxonomies", "photo-categories", search],
		queryFn: async () => {
			const res = await taxonomyServices["photo-categories"].getAll({ limit: 100, search: search || undefined });
			return res.taxonomies.map((t) => ({ id: t.id, title: t.name, slug: t.slug, status: t.status }));
		},
		staleTime: 1000 * 30,
	});

	const items = React.useMemo(() => data ?? [], [data]);
	const [local, setLocal] = React.useState(items);
	React.useEffect(() => setLocal(items), [items]);

	const reorderMutation = useMutation({
		mutationFn: (orderedIds: number[]) => taxonomyServices["photo-categories"].reorder(orderedIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["taxonomies", "photo-categories"] });
		},
	});

	const onDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = local.findIndex((c) => c.id === active.id);
		const newIndex = local.findIndex((c) => c.id === over.id);
		const next = arrayMove(local, oldIndex, newIndex);
		setLocal(next);
		reorderMutation.mutate(next.map((c) => c.id));
	};

	const [selected, setSelected] = React.useState<{
		id: number;
		title: string;
		status?: string;
	} | null>(null);

	// Clear selection if it no longer exists in filtered items
	React.useEffect(() => {
		if (selected && !items.find((c) => c.id === selected.id)) {
			setSelected(null);
		}
	}, [items, selected]);

	return (
		<div className="grid grid-cols-2 gap-6 relative overflow-hidden md:overflow-visible">
			<div
				className={`col-span-2 md:col-span-1 space-y-2 transition-all absolute w-full ${
					selected ? "-left-full -ml-4" : "left-0"
				} md:relative md:left-0 md:ml-0`}
			>
				{isLoading ? (
					<div className="p-4">
						<Skeleton className="h-6 w-full mb-2" />
						<Skeleton className="h-6 w-3/4 mb-2" />
						<Skeleton className="h-6 w-5/6" />
					</div>
				) : (
					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
						<SortableContext items={local.map((c) => c.id)} strategy={verticalListSortingStrategy}>
							{local.map((c) => (
								<SortableRow key={c.id} id={c.id}>
									{(dragProps) => (
										<div
											{...dragProps}
											onClick={() =>
												setSelected({
													id: c.id,
													title: c.title,
													status: c.status,
												})
											}
											className={`flex items-center justify-between rounded-md border p-4 hover:bg-accent cursor-pointer ${
												selected?.id === c.id ? "bg-accent" : ""
											}`}
										>
											<div className="flex items-center gap-3">
												<div>
													<div className="font-medium">{c.title}</div>
													<div className="text-xs text-muted-foreground">
														{c.status === "PUBLISHED" ? "Published" : "Draft"}
													</div>
												</div>
											</div>
											<IconChevronRight className="h-4 w-4 text-muted-foreground" />
										</div>
									)}
								</SortableRow>
							))}
						</SortableContext>
					</DndContext>
				)}
				{!isLoading && items.length === 0 && (
					<div className="p-6 text-sm text-muted-foreground">No categories found.</div>
				)}
			</div>
			<div
				className={`col-span-2 md:col-span-1 transition-all absolute w-full ${
					selected ? "left-0" : "left-full ml-4"
				} md:relative md:left-0 md:ml-0`}
			>
				{selected ? (
					<div className="rounded-md border p-4 top-20 sticky">
						<div className="mb-4 flex items-center">
							<Button variant={"ghost"} className="visible md:hidden mr-2" onClick={() => setSelected(null)}>
								<IconChevronLeft className="h-4 w-4" />
							</Button>
							<div className="space-y-1">
								<h2 className="text-xl font-semibold">{selected.title}</h2>
								<div className="text-sm text-muted-foreground">Manage images for this category</div>
							</div>
						</div>
						<Separator className="mb-4" />
						<ImagesManager parentType="category" parentId={selected.id} />
					</div>
				) : (
					<div className="rounded-md border p-6 text-sm text-muted-foreground top-20 sticky">
						Select a category to manage images.
					</div>
				)}
			</div>
		</div>
	);
}

// LinkRow removed; CategoriesList now renders rows inline with DnD
