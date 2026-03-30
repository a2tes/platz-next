"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import * as z from "zod";
import {
	Trash,
	Plus,
	CalendarIcon,
	Search,
	ChevronDown,
	Check,
	GripVertical,
	Film,
	Camera,
	ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
	DragStartEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
	Presentation,
	PresentationService,
	CreatePresentationDto,
	SectionInput,
	ItemInput,
	PhotographyOption,
	AnimationOption,
} from "@/services/presentationService";
import { WorksService } from "@/services/worksService";
import { PhotographyService, Photographer } from "@/services/photographyService";
import { taxonomyServices } from "@/services/taxonomyService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { toast } from "sonner";

// ============================================
// SCHEMA
// ============================================

const itemSchema = z.object({
	itemType: z.enum(["WORK", "ANIMATION", "PHOTOGRAPHY", "EXTERNAL_LINK"]),
	workId: z.number().optional(),
	animationId: z.number().optional(),
	photographyId: z.number().optional(),
	externalUrl: z.string().optional(),
	externalTitle: z.string().optional(),
	externalDescription: z.string().optional(),
	externalThumbnailId: z.number().optional(),
	// UI-only fields for display
	_label: z.string().optional(),
	_image: z.string().optional(),
});

const sectionSchema = z.object({
	title: z.string().min(1, "Section title is required"),
	type: z.enum(["ANIMATIONS", "PHOTOGRAPHY", "MIXED"]),
	items: z.array(itemSchema),
});

const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	clientName: z.string().optional(),
	clientNote: z.string().optional(),
	autoPlayEnabled: z.boolean(),
	photoSlideDuration: z.number().min(1).max(30),
	validUntil: z.string().optional().nullable(),
	isActive: z.boolean(),
	sections: z.array(sectionSchema),
});

type PresentationFormValues = z.infer<typeof formSchema>;
type SectionFormValue = z.infer<typeof sectionSchema>;
type ItemFormValue = z.infer<typeof itemSchema>;

// ============================================
// SORTABLE ITEM COMPONENT
// ============================================

function SortableItem({ id, item, onRemove }: { id: string; item: ItemFormValue; onRemove: () => void }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const typeIcon =
		item.itemType === "WORK" ? (
			<Film className="h-3.5 w-3.5" />
		) : item.itemType === "ANIMATION" ? (
			<Film className="h-3.5 w-3.5" />
		) : item.itemType === "EXTERNAL_LINK" ? (
			<ExternalLink className="h-3.5 w-3.5" />
		) : (
			<Camera className="h-3.5 w-3.5" />
		);
	const typeLabel =
		item.itemType === "WORK"
			? "Work"
			: item.itemType === "ANIMATION"
				? "Animation"
				: item.itemType === "EXTERNAL_LINK"
					? "External Link"
					: "Photo";

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-center gap-2 p-2 rounded-md bg-muted border",
				isDragging && "ring-2 ring-primary shadow-lg",
			)}
		>
			<div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
				<GripVertical className="h-4 w-4 text-muted-foreground" />
			</div>
			{item._image ? (
				<img src={item._image} alt="" className="h-10 w-14 rounded object-cover flex-shrink-0" />
			) : (
				<div className="h-10 w-14 rounded bg-accent flex items-center justify-center flex-shrink-0">{typeIcon}</div>
			)}
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{item._label || "Unknown"}</p>
				<p className="text-xs text-muted-foreground">{typeLabel}</p>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={onRemove}
				className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
			>
				<Trash className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

// ============================================
// SORTABLE SECTION COMPONENT
// ============================================

interface SortableSectionProps {
	id: string;
	index: number;
	form: any;
	onRemove: () => void;
	isDraggingAny: boolean;
}

function SortableSection({ id, index, form, onRemove, isDraggingAny }: SortableSectionProps) {
	const [isOpen, setIsOpen] = useState(true);
	const [isAddItemOpen, setIsAddItemOpen] = useState(false);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

	useEffect(() => {
		if (isDraggingAny) setIsOpen(false);
	}, [isDraggingAny]);

	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 1 : 0,
		opacity: isDragging ? 0.5 : 1,
	};

	const sectionType: string = form.watch(`sections.${index}.type`);
	const items: ItemFormValue[] = form.watch(`sections.${index}.items`) || [];

	const itemSensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const handleItemDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const currentItems = [...items];
			const oldIdx = currentItems.findIndex((_, i) => `item-${index}-${i}` === active.id);
			const newIdx = currentItems.findIndex((_, i) => `item-${index}-${i}` === over.id);
			if (oldIdx !== -1 && newIdx !== -1) {
				const [moved] = currentItems.splice(oldIdx, 1);
				currentItems.splice(newIdx, 0, moved);
				form.setValue(`sections.${index}.items`, currentItems);
			}
		}
	};

	const removeItem = (itemIdx: number) => {
		const currentItems = [...items];
		currentItems.splice(itemIdx, 1);
		form.setValue(`sections.${index}.items`, currentItems);
	};

	const addItems = (newItems: ItemFormValue[]) => {
		form.setValue(`sections.${index}.items`, [...items, ...newItems]);
	};

	return (
		<div ref={setNodeRef} style={style} className={cn("mb-4", isDragging && "relative z-50")}>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<Card className={cn("py-0 gap-0", isDragging && "ring-2 ring-primary shadow-lg")}>
					<CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-3">
						<div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
							<GripVertical className="h-4 w-4 text-muted-foreground" />
						</div>
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="flex items-center gap-2 flex-1 min-w-0"
								onPointerDown={(e) => e.stopPropagation()}
							>
								<ChevronDown className={cn("h-4 w-4 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
								<span className="font-medium truncate">
									{form.watch(`sections.${index}.title`) || "Untitled Section"}
								</span>
								<span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
									{items.length} item{items.length !== 1 ? "s" : ""}
								</span>
							</button>
						</CollapsibleTrigger>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onPointerDown={(e) => e.stopPropagation()}
							onClick={onRemove}
							className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
						>
							<Trash className="h-4 w-4" />
						</Button>
					</CardHeader>
					<CollapsibleContent>
						<CardContent className="pt-0 pb-4 space-y-4" onPointerDown={(e) => e.stopPropagation()}>
							{/* Section settings */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<FormField
									control={form.control}
									name={`sections.${index}.title`}
									render={({ field }) => (
										<FormItem>
											<FormLabel>Section Title</FormLabel>
											<FormControl>
												<Input placeholder="e.g. Director's Reel, Photography..." {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name={`sections.${index}.type`}
									render={({ field }) => (
										<FormItem>
											<FormLabel>Section Type</FormLabel>
											<Select onValueChange={field.onChange} value={field.value}>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="ANIMATIONS">Animations</SelectItem>
													<SelectItem value="PHOTOGRAPHY">Photography</SelectItem>
													<SelectItem value="MIXED">Mixed</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{/* Items list */}
							{items.length === 0 ? (
								<div className="text-center text-sm py-6 text-muted-foreground border-2 border-dashed rounded-lg">
									No items added yet.
								</div>
							) : (
								<DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
									<SortableContext
										items={items.map((_, i) => `item-${index}-${i}`)}
										strategy={verticalListSortingStrategy}
									>
										<div className="space-y-1.5">
											{items.map((item, itemIdx) => (
												<SortableItem
													key={`item-${index}-${itemIdx}`}
													id={`item-${index}-${itemIdx}`}
													item={item}
													onRemove={() => removeItem(itemIdx)}
												/>
											))}
										</div>
									</SortableContext>
								</DndContext>
							)}

							{/* Add items button */}
							<AddItemDialog
								sectionType={sectionType}
								existingItems={items}
								onAdd={addItems}
								open={isAddItemOpen}
								onOpenChange={setIsAddItemOpen}
							/>
						</CardContent>
					</CollapsibleContent>
				</Card>
			</Collapsible>
		</div>
	);
}

// ============================================
// ADD ITEM DIALOG
// ============================================

interface AddItemDialogProps {
	sectionType: string;
	existingItems: ItemFormValue[];
	onAdd: (items: ItemFormValue[]) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function AddItemDialog({ sectionType, existingItems, onAdd, open, onOpenChange }: AddItemDialogProps) {
	const initialTab =
		sectionType === "ANIMATIONS" ? "ANIMATION" : sectionType === "PHOTOGRAPHY" ? "PHOTOGRAPHY" : "WORK";
	const [tab, setTab] = useState<"WORK" | "ANIMATION" | "PHOTOGRAPHY" | "EXTERNAL_LINK">(initialTab);

	// Sync tab when sectionType changes (e.g. user changes section type while dialog is mounted)
	useEffect(() => {
		const newTab = sectionType === "ANIMATIONS" ? "ANIMATION" : sectionType === "PHOTOGRAPHY" ? "PHOTOGRAPHY" : "WORK";
		setTab(newTab as "WORK" | "ANIMATION" | "PHOTOGRAPHY" | "EXTERNAL_LINK");
	}, [sectionType]);
	const [search, setSearch] = useState("");
	const [selectedPhotographerId, setSelectedPhotographerId] = useState<number | null>(null);
	const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
	const [selectedItems, setSelectedItems] = useState<ItemFormValue[]>([]);
	const [externalUrl, setExternalUrl] = useState("");
	const [externalTitle, setExternalTitle] = useState("");
	const [externalDescription, setExternalDescription] = useState("");
	const [externalThumbnailId, setExternalThumbnailId] = useState<number | null>(null);
	const [externalThumbnailUrl, setExternalThumbnailUrl] = useState<string | null>(null);
	const openSelectorModal = useMediaLibraryStore((s) => s.openSelectorModal);

	// Fetch works for the WORK tab
	const { data: worksResponse } = useQuery({
		queryKey: ["presentation-works", search],
		queryFn: () => WorksService.getWorks({ limit: 100, search: search || undefined, status: "PUBLISHED" }),
		staleTime: 2 * 60 * 1000,
		enabled: open && tab === "WORK",
	});
	const allWorks = worksResponse?.data || [];

	// Fetch photography options
	const { data: photographyOptions } = useQuery({
		queryKey: ["presentation-photography-options", selectedPhotographerId, selectedCategoryId, search],
		queryFn: () =>
			PresentationService.getPhotographyOptions({
				photographerId: selectedPhotographerId || undefined,
				categoryId: selectedCategoryId || undefined,
				search: search || undefined,
			}),
		staleTime: 2 * 60 * 1000,
		enabled: open && tab === "PHOTOGRAPHY",
	});

	// Fetch animation options
	const { data: animationOptions } = useQuery({
		queryKey: ["presentation-animation-options", search],
		queryFn: () => PresentationService.getAnimationOptions({ search: search || undefined }),
		staleTime: 2 * 60 * 1000,
		enabled: open && tab === "ANIMATION",
	});

	// Fetch photographers for filter
	const { data: photographersResponse } = useQuery({
		queryKey: ["photographers", "all"],
		queryFn: () => PhotographyService.getPhotographers({ limit: 100 }),
		staleTime: 5 * 60 * 1000,
		enabled: open && tab === "PHOTOGRAPHY",
	});
	const photographers = photographersResponse?.data || [];

	// Fetch categories for filter
	const { data: categoriesResponse } = useQuery({
		queryKey: ["taxonomies", "photo-categories", "all"],
		queryFn: async () => {
			const res = await taxonomyServices["photo-categories"].getAll({ limit: 100 });
			return res.taxonomies.map((t) => ({ id: t.id, title: t.name, slug: t.slug }));
		},
		staleTime: 5 * 60 * 1000,
		enabled: open && tab === "PHOTOGRAPHY",
	});
	const categories = categoriesResponse || [];

	// Reset state when dialog opens/tab changes
	useEffect(() => {
		if (open) {
			setSelectedItems([]);
			setSearch("");
			setExternalUrl("");
			setExternalTitle("");
		}
	}, [open]);

	useEffect(() => {
		setSearch("");
		setSelectedItems([]);
		setSelectedPhotographerId(null);
		setSelectedCategoryId(null);
		setExternalUrl("");
		setExternalTitle("");
	}, [tab]);

	const existingWorkIds = new Set(existingItems.filter((i) => i.itemType === "WORK").map((i) => i.workId));
	const existingAnimationIds = new Set(
		existingItems.filter((i) => i.itemType === "ANIMATION").map((i) => i.animationId),
	);
	const existingPhotoIds = new Set(
		existingItems.filter((i) => i.itemType === "PHOTOGRAPHY").map((i) => i.photographyId),
	);

	const toggleSelection = (item: ItemFormValue) => {
		const key =
			item.itemType === "WORK" ? item.workId : item.itemType === "ANIMATION" ? item.animationId : item.photographyId;
		const exists = selectedItems.find((s) => {
			const sKey = s.itemType === "WORK" ? s.workId : s.itemType === "ANIMATION" ? s.animationId : s.photographyId;
			return sKey === key && s.itemType === item.itemType;
		});
		if (exists) {
			setSelectedItems((prev) =>
				prev.filter((s) => {
					const sKey = s.itemType === "WORK" ? s.workId : s.itemType === "ANIMATION" ? s.animationId : s.photographyId;
					return !(sKey === key && s.itemType === item.itemType);
				}),
			);
		} else {
			setSelectedItems((prev) => [...prev, item]);
		}
	};

	const isSelected = (itemType: string, id: number) => {
		return selectedItems.some((s) => {
			const sKey = s.itemType === "WORK" ? s.workId : s.itemType === "ANIMATION" ? s.animationId : s.photographyId;
			return sKey === id && s.itemType === itemType;
		});
	};

	const handleAdd = () => {
		if (tab === "EXTERNAL_LINK" && externalUrl) {
			onAdd([
				{
					itemType: "EXTERNAL_LINK",
					externalUrl,
					externalTitle: externalTitle || undefined,
					externalDescription: externalDescription || undefined,
					externalThumbnailId: externalThumbnailId || undefined,
					_label: externalTitle || externalUrl,
					_image: externalThumbnailUrl || undefined,
				},
			]);
			setExternalUrl("");
			setExternalTitle("");
			setExternalDescription("");
			setExternalThumbnailId(null);
			setExternalThumbnailUrl(null);
			onOpenChange(false);
			return;
		}
		onAdd(selectedItems);
		setSelectedItems([]);
		onOpenChange(false);
	};

	// Available tabs based on section type
	const availableTabs: readonly string[] =
		sectionType === "ANIMATIONS"
			? ["ANIMATION", "EXTERNAL_LINK"]
			: sectionType === "PHOTOGRAPHY"
				? ["PHOTOGRAPHY", "EXTERNAL_LINK"]
				: ["WORK", "ANIMATION", "PHOTOGRAPHY", "EXTERNAL_LINK"];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" type="button">
					<Plus className="mr-2 h-4 w-4" />
					Add Items
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
				<DialogHeader className="mb-2">
					<DialogTitle>Add Items</DialogTitle>
					<DialogDescription>Select items to add to this section.</DialogDescription>
				</DialogHeader>

				{/* Tab buttons */}
				{availableTabs.length > 1 && (
					<div className="flex gap-1 border rounded-lg p-1">
						{availableTabs.includes("WORK") && (
							<button
								type="button"
								onClick={() => setTab("WORK")}
								className={cn(
									"flex-1 px-3 py-1.5 text-sm rounded-md transition-colors",
									tab === "WORK" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
								)}
							>
								Works
							</button>
						)}
						{availableTabs.includes("ANIMATION") && (
							<button
								type="button"
								onClick={() => setTab("ANIMATION")}
								className={cn(
									"flex-1 px-3 py-1.5 text-sm rounded-md transition-colors",
									tab === "ANIMATION" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
								)}
							>
								Animations
							</button>
						)}
						{availableTabs.includes("PHOTOGRAPHY") && (
							<button
								type="button"
								onClick={() => setTab("PHOTOGRAPHY")}
								className={cn(
									"flex-1 px-3 py-1.5 text-sm rounded-md transition-colors",
									tab === "PHOTOGRAPHY" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
								)}
							>
								Photography
							</button>
						)}
						{availableTabs.includes("EXTERNAL_LINK") && (
							<button
								type="button"
								onClick={() => setTab("EXTERNAL_LINK")}
								className={cn(
									"flex-1 px-3 py-1.5 text-sm rounded-md transition-colors",
									tab === "EXTERNAL_LINK" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
								)}
							>
								External Link
							</button>
						)}
					</div>
				)}

				{/* WORK TAB */}
				{tab === "WORK" && (
					<div className="my-3 space-y-3 flex-1 overflow-hidden flex flex-col">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search works..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-9"
							/>
						</div>
						<div className="overflow-y-auto border rounded-md max-h-[300px]">
							{allWorks.length === 0 ? (
								<div className="p-4 text-sm text-muted-foreground text-center">No works found</div>
							) : (
								allWorks.map((w) => {
									const alreadyAdded = existingWorkIds.has(w.id);
									const selected = isSelected("WORK", w.id);
									return (
										<button
											key={w.id}
											type="button"
											disabled={alreadyAdded}
											onClick={() =>
												toggleSelection({
													itemType: "WORK",
													workId: w.id,
													_label: w.title,
													_image: w.previewImage?.images?.thumbnail || w.previewImage?.images?.original || undefined,
												})
											}
											className={cn(
												"w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors",
												selected && "bg-accent",
												alreadyAdded && "opacity-50 cursor-not-allowed",
											)}
										>
											<span>{w.title}</span>
											{(selected || alreadyAdded) && <Check className="h-4 w-4 text-primary" />}
										</button>
									);
								})
							)}
						</div>
					</div>
				)}

				{/* ANIMATION TAB */}
				{tab === "ANIMATION" && (
					<div className="my-3 space-y-3 flex-1 overflow-hidden flex flex-col">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search animations..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-9"
							/>
						</div>
						<div className="overflow-y-auto border rounded-md max-h-[300px]">
							{!animationOptions || animationOptions.length === 0 ? (
								<div className="p-4 text-sm text-muted-foreground text-center">No animations found</div>
							) : (
								animationOptions.map((a) => {
									const alreadyAdded = existingAnimationIds.has(a.id);
									const selected = isSelected("ANIMATION", a.id);
									return (
										<button
											key={a.id}
											type="button"
											disabled={alreadyAdded}
											onClick={() =>
												toggleSelection({
													itemType: "ANIMATION",
													animationId: a.id,
													_label: a.title,
													_image: a.previewImage?.url,
												})
											}
											className={cn(
												"w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors",
												selected && "bg-accent",
												alreadyAdded && "opacity-50 cursor-not-allowed",
											)}
										>
											{a.previewImage?.url ? (
												<img src={a.previewImage.url} alt="" className="h-8 w-12 rounded object-cover" />
											) : (
												<div className="h-8 w-12 rounded bg-muted flex items-center justify-center">
													<Film className="h-3.5 w-3.5" />
												</div>
											)}
											<span className="flex-1 text-left truncate">{a.title}</span>
											{(selected || alreadyAdded) && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
										</button>
									);
								})
							)}
						</div>
					</div>
				)}

				{/* PHOTOGRAPHY TAB */}
				{tab === "PHOTOGRAPHY" && (
					<div className="my-3 space-y-3 flex-1 overflow-hidden flex flex-col">
						<div className="grid grid-cols-2 gap-2">
							<Select
								value={selectedPhotographerId?.toString() || "all"}
								onValueChange={(val) => setSelectedPhotographerId(val === "all" ? null : parseInt(val))}
							>
								<SelectTrigger>
									<SelectValue placeholder="Photographer..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Photographers</SelectItem>
									{photographers.map((p) => (
										<SelectItem key={p.id} value={p.id.toString()}>
											{p.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={selectedCategoryId?.toString() || "all"}
								onValueChange={(val) => setSelectedCategoryId(val === "all" ? null : parseInt(val))}
							>
								<SelectTrigger>
									<SelectValue placeholder="Category..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Categories</SelectItem>
									{categories.map((c) => (
										<SelectItem key={c.id} value={c.id.toString()}>
											{c.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="overflow-y-auto border rounded-md max-h-[300px]">
							{!photographyOptions || photographyOptions.length === 0 ? (
								<div className="p-4 text-sm text-muted-foreground text-center">No photos found</div>
							) : (
								<div className="grid grid-cols-3 gap-1 p-1">
									{photographyOptions.map((p) => {
										const alreadyAdded = existingPhotoIds.has(p.id);
										const selected = isSelected("PHOTOGRAPHY", p.id);
										return (
											<button
												key={p.id}
												type="button"
												disabled={alreadyAdded}
												onClick={() =>
													toggleSelection({
														itemType: "PHOTOGRAPHY",
														photographyId: p.id,
														_label: p.title,
														_image: p.image?.url,
													})
												}
												className={cn(
													"relative aspect-square rounded overflow-hidden group",
													alreadyAdded && "opacity-50 cursor-not-allowed",
												)}
											>
												{p.image?.url ? (
													<img src={p.image.url} alt="" className="w-full h-full object-cover" />
												) : (
													<div className="w-full h-full bg-muted flex items-center justify-center">
														<Camera className="h-5 w-5" />
													</div>
												)}
												{(selected || alreadyAdded) && (
													<div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
														<Check className="h-6 w-6 text-white" />
													</div>
												)}
											</button>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}

				{/* EXTERNAL_LINK TAB */}
				{tab === "EXTERNAL_LINK" && (
					<div className="my-3 space-y-3 flex-1 overflow-hidden flex flex-col">
						<div>
							<label className="text-sm font-medium">URL *</label>
							<Input
								placeholder="https://vimeo.com/..."
								value={externalUrl}
								onChange={(e) => setExternalUrl(e.target.value)}
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Title</label>
							<Input
								placeholder="e.g. Director's Vimeo Reel"
								value={externalTitle}
								onChange={(e) => setExternalTitle(e.target.value)}
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Description</label>
							<Textarea
								placeholder="Optional description..."
								value={externalDescription}
								onChange={(e) => setExternalDescription(e.target.value)}
								rows={3}
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Thumbnail</label>
							<div className="flex items-center gap-3 mt-1">
								{externalThumbnailUrl ? (
									<div className="relative w-20 h-14 rounded border overflow-hidden">
										<img src={externalThumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
										<button
											type="button"
											className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
											onClick={() => {
												setExternalThumbnailId(null);
												setExternalThumbnailUrl(null);
											}}
										>
											×
										</button>
									</div>
								) : null}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										openSelectorModal("image", (file) => {
											setExternalThumbnailId(file.id);
											setExternalThumbnailUrl(file.images.small);
										})
									}
								>
									{externalThumbnailUrl ? "Change" : "Select Image"}
								</Button>
							</div>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					{tab === "EXTERNAL_LINK" ? (
						<Button type="button" onClick={handleAdd} disabled={!externalUrl}>
							Add External Link
						</Button>
					) : (
						<Button type="button" onClick={handleAdd} disabled={selectedItems.length === 0}>
							Add{" "}
							{selectedItems.length > 0
								? `${selectedItems.length} Item${selectedItems.length > 1 ? "s" : ""}`
								: "Items"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ============================================
// MAIN FORM
// ============================================

interface PresentationFormProps {
	initialData?: Presentation;
}

export function PresentationForm({ initialData }: PresentationFormProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [loading, setLoading] = useState(false);
	const [isDraggingAny, setIsDraggingAny] = useState(false);

	// Transform initialData sections → form values
	const initialSections: SectionFormValue[] =
		initialData?.sections
			?.sort((a, b) => a.sortOrder - b.sortOrder)
			.map((s) => ({
				title: s.title,
				type: s.type,
				items: s.items
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map((item) => ({
						itemType: item.itemType,
						workId: item.workId || undefined,
						animationId: item.animationId || undefined,
						photographyId: item.photographyId || undefined,
						externalUrl: item.externalUrl || undefined,
						externalTitle: item.externalTitle || undefined,
						externalDescription: item.externalDescription || undefined,
						externalThumbnailId: item.externalThumbnailId || undefined,
						_label:
							item.work?.title ||
							item.animation?.title ||
							item.photography?.title ||
							item.externalTitle ||
							item.externalUrl ||
							"Unknown",
						_image:
							item.work?.previewImage?.url ||
							item.animation?.previewImage?.url ||
							item.photography?.image?.url ||
							item.externalThumbnail?.url ||
							undefined,
					})),
			})) || [];

	const form = useForm<PresentationFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: initialData?.title || "",
			description: initialData?.description || "",
			clientName: initialData?.clientName || "",
			clientNote: initialData?.clientNote || "",
			autoPlayEnabled: initialData?.autoPlayEnabled ?? true,
			photoSlideDuration: initialData?.photoSlideDuration ?? 5,
			validUntil:
				initialData?.validUntil && !isNaN(new Date(initialData.validUntil).getTime()) ? initialData.validUntil : "",
			isActive: initialData?.isActive ?? true,
			sections: initialSections,
		},
	});

	const {
		fields: sectionFields,
		append: appendSection,
		remove: removeSection,
		move: moveSection,
	} = useFieldArray({
		control: form.control,
		name: "sections",
	});

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const handleDragStart = () => setIsDraggingAny(true);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = sectionFields.findIndex((f) => f.id === active.id);
			const newIndex = sectionFields.findIndex((f) => f.id === over.id);
			moveSection(oldIndex, newIndex);
		}
		setIsDraggingAny(false);
	};

	const handleAddSection = () => {
		appendSection({
			title: "",
			type: "ANIMATIONS",
			items: [],
		});
	};

	const onSubmit = async (data: PresentationFormValues) => {
		setLoading(true);
		try {
			// Strip UI-only fields from items
			const sections: SectionInput[] = data.sections.map((s) => ({
				title: s.title,
				type: s.type,
				items: s.items.map((item) => ({
					itemType: item.itemType,
					workId: item.workId,
					animationId: item.animationId,
					photographyId: item.photographyId,
					externalUrl: item.externalUrl,
					externalTitle: item.externalTitle,
					externalDescription: item.externalDescription,
					externalThumbnailId: item.externalThumbnailId,
				})),
			}));

			const payload: CreatePresentationDto = {
				title: data.title,
				description: data.description,
				clientName: data.clientName,
				clientNote: data.clientNote,
				autoPlayEnabled: data.autoPlayEnabled,
				photoSlideDuration: data.photoSlideDuration,
				validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : null,
				isActive: data.isActive,
				sections,
			};

			if (initialData) {
				await PresentationService.update(initialData.id, payload);
				await queryClient.invalidateQueries({ queryKey: ["presentation", initialData.id] });
				toast.success("Presentation updated");
			} else {
				const created = await PresentationService.create(payload);
				toast.success("Presentation created");
				router.push(`/presentations/${created.id}/edit`);
			}
			await queryClient.invalidateQueries({ queryKey: ["presentations"] });
			await queryClient.invalidateQueries({ queryKey: ["presentations-counts"] });
		} catch (error) {
			console.error("Failed to save presentation", error);
			toast.error("Failed to save presentation");
		} finally {
			setLoading(false);
		}
	};

	const isActive = form.watch("isActive");
	const autoPlayEnabled = form.watch("autoPlayEnabled");

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 md:gap-6 items-start">
				{/* Left Column - Main Form Content */}
				<div className="lg:col-span-2 space-y-6">
					{/* Basic Information - Only show when creating new presentation */}
					{!initialData && (
						<div className="border rounded-xl mb-6">
							<h3 className="text-lg font-semibold border-b p-4">Basic Information</h3>
							<div className="p-4 space-y-4">
								<FormField
									control={form.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title</FormLabel>
											<FormControl>
												<Input placeholder="Presentation title..." {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</div>
					)}

					{/* Client Information */}
					<div className="border rounded-xl mb-6">
						<h3 className="text-lg font-semibold border-b p-4">Client Information</h3>
						<div className="p-4 space-y-4">
							<FormField
								control={form.control}
								name="clientName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Client Name</FormLabel>
										<FormControl>
											<Input placeholder="Client or company name..." {...field} />
										</FormControl>
										<FormDescription>Displayed on the splash screen and header.</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="clientNote"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Client Note</FormLabel>
										<FormControl>
											<Textarea placeholder="A personal note for the client..." className="resize-none" {...field} />
										</FormControl>
										<FormDescription>Shown on the splash screen below the client name.</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Sections */}
					<div className="border rounded-xl mb-6">
						<div className="border-b p-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">Sections</h3>
							<Button variant="outline" size="sm" type="button" onClick={handleAddSection}>
								<Plus className="mr-2 h-4 w-4" />
								Add Section
							</Button>
						</div>
						<div className="p-4">
							{sectionFields.length === 0 ? (
								<div className="text-center text-sm py-8 text-muted-foreground border-2 border-dashed rounded-lg">
									No sections added yet. Click "Add Section" to start building.
								</div>
							) : (
								<>
									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragStart={handleDragStart}
										onDragEnd={handleDragEnd}
									>
										<SortableContext items={sectionFields} strategy={verticalListSortingStrategy}>
											{sectionFields.map((field, index) => (
												<SortableSection
													key={field.id}
													id={field.id}
													index={index}
													form={form}
													onRemove={() => removeSection(index)}
													isDraggingAny={isDraggingAny}
												/>
											))}
										</SortableContext>
									</DndContext>
									<div className="flex justify-center mt-4">
										<Button variant="outline" size="sm" type="button" onClick={handleAddSection}>
											<Plus className="mr-2 h-4 w-4" />
											Add Section
										</Button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Right Column - Status & Actions */}
				<div className="flex flex-col-reverse lg:flex-col gap-6">
					{/* Status Card */}
					<div className="border rounded-xl overflow-hidden">
						<div className="border-b p-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">Status</h3>
							<div className="flex gap-4">
								<span className="text-sm font-medium">{isActive ? "Active" : "Inactive"}</span>
								<FormField
									control={form.control}
									name="isActive"
									render={({ field }) => (
										<FormItem className="flex items-center space-y-0">
											<FormControl>
												<button
													type="button"
													onClick={() => field.onChange(!field.value)}
													className={cn(
														"relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
														field.value ? "bg-green-600" : "bg-gray-300",
													)}
												>
													<span
														className={cn(
															"inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
															field.value ? "translate-x-4.5" : "translate-x-0.5",
														)}
													/>
												</button>
											</FormControl>
										</FormItem>
									)}
								/>
							</div>
						</div>
						<div className="p-4 space-y-4">
							<FormField
								control={form.control}
								name="validUntil"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Valid Until</FormLabel>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant={"outline"}
														className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
													>
														{(() => {
															if (!field.value || isNaN(new Date(field.value).getTime()))
																return <span>Pick a date</span>;
															const utcDate = new Date(field.value);
															const localDate = new Date(
																utcDate.getUTCFullYear(),
																utcDate.getUTCMonth(),
																utcDate.getUTCDate(),
															);
															return format(localDate, "PPP");
														})()}
														<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													selected={(() => {
														if (!field.value || isNaN(new Date(field.value).getTime())) return undefined;
														const utcDate = new Date(field.value);
														return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
													})()}
													onSelect={(date) => {
														if (date instanceof Date && !isNaN(date.getTime())) {
															const utcDate = new Date(
																Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
															);
															field.onChange(utcDate.toISOString());
														} else {
															field.onChange(null);
														}
													}}
													disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
													initialFocus
												/>
											</PopoverContent>
										</Popover>
										<FormDescription>Leave empty for no expiration.</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex gap-4">
								<Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
									Cancel
								</Button>
								<Button
									type="submit"
									className={cn("flex-1", isActive ? "bg-green-600 hover:bg-green-700" : "")}
									disabled={loading}
								>
									{loading ? "Saving..." : "Save"}
								</Button>
							</div>
						</div>
					</div>

					{/* Playback Settings */}
					<div className="border rounded-xl overflow-hidden">
						<div className="border-b p-4">
							<h3 className="text-lg font-semibold">Playback Settings</h3>
						</div>
						<div className="p-4 space-y-4">
							<FormField
								control={form.control}
								name="autoPlayEnabled"
								render={({ field }) => (
									<FormItem className="flex items-center justify-between">
										<FormLabel>Auto-Play Mode</FormLabel>
										<FormControl>
											<button
												type="button"
												onClick={() => field.onChange(!field.value)}
												className={cn(
													"relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
													field.value ? "bg-green-600" : "bg-gray-300",
												)}
											>
												<span
													className={cn(
														"inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
														field.value ? "translate-x-4.5" : "translate-x-0.5",
													)}
												/>
											</button>
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="photoSlideDuration"
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center justify-between">
											<FormLabel>Photo Slide Duration</FormLabel>
											<span className="text-sm text-muted-foreground">{field.value}s</span>
										</div>
										<FormControl>
											<input
												type="range"
												min={1}
												max={30}
												value={field.value}
												onChange={(e) => field.onChange(parseInt(e.target.value))}
												className="w-full"
											/>
										</FormControl>
										<FormDescription>How long each photo stays on screen in auto-play mode.</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Notes */}
					<div className="border rounded-xl overflow-hidden">
						<div className="border-b p-4">
							<h3 className="text-lg font-semibold">Note for yourself</h3>
						</div>
						<div className="p-4 space-y-4">
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Textarea
												placeholder="Internal notes you don't want to forget about this presentation..."
												className="resize-none"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>
				</div>
			</form>
		</Form>
	);
}
