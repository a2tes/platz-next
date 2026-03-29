"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiAutocomplete, type AutocompleteOption } from "@/components/ui/multi-autocomplete";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PhotographyItem, ClientEntity, StarringEntity } from "@/services/photographyItemsService";
import clientsService from "@/services/clientsService";
import starringsService from "@/services/starringsService";
import { PhotographyService } from "@/services/photographyService";

export type ImageItemCardMode = "photographer" | "category";

export interface Option {
	label: string;
	value: string;
}

export interface EditValues {
	title: string;
	description?: string;
	year?: number;
	location?: string;
	categoryIds?: number[];
	photographerId?: number;
	// Legacy (for backward compatibility)
	client?: string;
	// New relation IDs
	clientIds?: number[];
	starringIds?: number[];
}

export function PhotographyItemEditModal({
	open,
	onOpenChange,
	item,
	mode,
	options,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: PhotographyItem & { __temp?: boolean };
	mode: ImageItemCardMode;
	options: Option[];
	onSubmit: (values: EditValues) => Promise<void> | void;
}) {
	// Search state for autocomplete
	const [clientSearch, setClientSearch] = React.useState("");
	const [starringSearch, setStarringSearch] = React.useState("");
	const [categorySearch, setCategorySearch] = React.useState("");

	// Fetch options for autocomplete
	const { data: clientOptions = [] } = useQuery({
		queryKey: ["clients-search", clientSearch],
		queryFn: () => clientsService.searchClients(clientSearch || "", 20),
		staleTime: 30000,
	});

	const { data: starringOptions = [] } = useQuery({
		queryKey: ["starrings-search", starringSearch],
		queryFn: () => starringsService.searchStarrings(starringSearch || "", 20),
		staleTime: 30000,
	});

	const { data: categoryOptions = [] } = useQuery({
		queryKey: ["categories-search", categorySearch],
		queryFn: () => PhotographyService.searchCategories(categorySearch || "", 20),
		staleTime: 30000,
	});

	// Selected entities state
	const [selectedClients, setSelectedClients] = React.useState<AutocompleteOption[]>([]);
	const [selectedStarrings, setSelectedStarrings] = React.useState<AutocompleteOption[]>([]);
	const [selectedCategory, setSelectedCategory] = React.useState<AutocompleteOption[]>([]);

	const [values, setValues] = React.useState<EditValues>(() => ({
		title: item.title || "",
		description: item.description || "",
		year: item.year,
		location: item.location || "",
		categoryIds: item.categories?.map((c) => c.category?.id ?? c.categoryId) || [],
		photographerId: item.photographerId,
		client: item.client || "",
		clientIds: item.clients?.map((c) => c.client?.id ?? c.clientId) || [],
		starringIds: item.starrings?.map((s) => s.starring?.id ?? s.starringId) || [],
	}));

	React.useEffect(() => {
		if (!open) return;
		setValues({
			title: item.title || "",
			description: item.description || "",
			year: item.year,
			location: item.location || "",
			categoryIds: item.categories?.map((c) => c.category?.id ?? c.categoryId) || [],
			photographerId: item.photographerId,
			client: item.client || "",
			clientIds: item.clients?.map((c) => c.client?.id ?? c.clientId) || [],
			starringIds: item.starrings?.map((s) => s.starring?.id ?? s.starringId) || [],
		});
		// Set selected entities from item (handle junction table format)
		setSelectedClients(
			item.clients?.map((c) => ({
				id: c.client?.id ?? c.clientId,
				name: c.client?.name ?? "",
			})) || [],
		);
		setSelectedStarrings(
			item.starrings?.map((s) => ({
				id: s.starring?.id ?? s.starringId,
				// Starring uses 'title' in DB but search maps it to 'name'
				name: s.starring?.title ?? s.starring?.name ?? "",
			})) || [],
		);
		// Set selected categories from item (handle junction table format)
		setSelectedCategory(
			item.categories?.map((c) => ({
				id: c.category?.id ?? c.categoryId,
				name: c.category?.title ?? "",
			})) || [],
		);
	}, [open, item]);

	// When creating from a selected image, auto-fill title from image originalName if empty
	React.useEffect(() => {
		if (!open) return;
		if (!item.__temp) return;
		if (values.title && values.title.trim().length > 0) return;
		const original = item.image?.originalName || item.image?.filename;
		if (!original) return;
		// Strip extension, replace separators with spaces, collapse whitespace
		const withoutExt = original.replace(/\.[^.]+$/, "");
		const beautified = withoutExt
			.replace(/[._-]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		if (beautified) {
			setValues((v) => ({ ...v, title: beautified }));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, item.__temp, item.image?.originalName, item.image?.filename]);

	// Handle client selection change
	const handleClientsChange = (clients: AutocompleteOption[]) => {
		setSelectedClients(clients);
		setValues((v) => ({ ...v, clientIds: clients.map((c) => c.id) }));
	};

	// Handle starring selection change
	const handleStarringsChange = (starrings: AutocompleteOption[]) => {
		setSelectedStarrings(starrings);
		setValues((v) => ({ ...v, starringIds: starrings.map((s) => s.id) }));
	};

	const queryClient = useQueryClient();

	// Create new client
	const handleCreateClient = async (name: string): Promise<AutocompleteOption> => {
		const created = await clientsService.findOrCreateClient(name);
		// Invalidate cache so new client appears in dropdown
		await queryClient.invalidateQueries({ queryKey: ["clients-search"] });
		return { id: created.id, name: created.name };
	};

	// Create new starring
	const handleCreateStarring = async (name: string): Promise<AutocompleteOption> => {
		const created = await starringsService.findOrCreateStarring(name);
		await queryClient.invalidateQueries({ queryKey: ["starrings-search"] });
		return { id: created.id, name: created.name };
	};

	// Handle category selection change
	const handleCategoryChange = (categories: AutocompleteOption[]) => {
		setSelectedCategory(categories);
		setValues((v) => ({ ...v, categoryIds: categories.map((c) => c.id) }));
	};

	// Create new category
	const handleCreateCategory = async (name: string): Promise<AutocompleteOption> => {
		const created = await PhotographyService.findOrCreateCategory(name);
		await queryClient.invalidateQueries({ queryKey: ["categories-search"] });
		return { id: created.id, name: created.name };
	};

	const canSave =
		values.title.trim().length > 0 &&
		(mode === "photographer" ? (values.categoryIds?.length ?? 0) > 0 : !!values.photographerId);

	const handleSave = async () => {
		await onSubmit(values);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
				<DialogHeader className="pb-4">
					<DialogTitle>{item.__temp ? "Create Photo Info" : "Edit Photo Info"}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="col-span-1">
						{/* Image preview */}
						{item.image?.images?.thumbnail || item.image?.images?.original ? (
							<div className="w-full">
								<div className="relative w-full overflow-hidden rounded-md border bg-muted h-48 md:h-95">
									<Image
										src={
											item.image.images.medium ||
											item.image.images.small ||
											item.image.images.thumbnail ||
											item.image.images.original
										}
										alt={item.image.originalName || values.title || "Selected image"}
										fill
										className="object-contain"
										unoptimized
									/>
								</div>
								<div className="text-xs text-muted-foreground mt-1 truncate">
									Original name: {item.image.originalName || item.image.filename}
								</div>
							</div>
						) : null}
					</div>

					<div className="col-span-1 space-y-4">
						{/* Title */}
						<div className="space-y-1">
							<Label className="pl-1">Title</Label>
							<Input
								value={values.title}
								onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
								placeholder="Title"
							/>
						</div>

						{/* Description */}
						<div className="space-y-1">
							<Label className="pl-1">Description</Label>
							<Textarea
								value={values.description || ""}
								onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
								placeholder="Description"
								className="resize-none h-20"
							/>
						</div>

						{/* Categories / Photographer */}
						<div className="space-y-1">
							<Label className="pl-1">{mode === "photographer" ? "Categories" : "Photographer"}</Label>
							{mode === "photographer" ? (
								<MultiAutocomplete
									values={selectedCategory}
									onValuesChange={handleCategoryChange}
									options={categoryOptions.map((c) => ({ id: c.id, name: c.name }))}
									onSearch={setCategorySearch}
									onCreateNew={handleCreateCategory}
									placeholder="Select categories..."
									searchPlaceholder="Search or create category..."
									emptyMessage="No categories found"
									allowCreate
								/>
							) : (
								<Select
									value={String(values.photographerId ?? "")}
									onValueChange={(val) => setValues((v) => ({ ...v, photographerId: Number(val) }))}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select photographer" />
									</SelectTrigger>
									<SelectContent>
										{options.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>

						{/* Client */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1">
								<Label className="pl-1">Client</Label>
								<MultiAutocomplete
									values={selectedClients}
									onValuesChange={handleClientsChange}
									options={clientOptions.map((c) => ({ id: c.id, name: c.name }))}
									onSearch={setClientSearch}
									onCreateNew={handleCreateClient}
									placeholder="Select client..."
									searchPlaceholder="Search or create client..."
									emptyMessage="No clients found"
									allowCreate
									single
								/>
							</div>
						</div>

						{/* Starrings */}
						<div className="space-y-1">
							<Label className="pl-1">Starrings</Label>
							<MultiAutocomplete
								values={selectedStarrings}
								onValuesChange={handleStarringsChange}
								options={starringOptions.map((s) => ({ id: s.id, name: s.name }))}
								onSearch={setStarringSearch}
								onCreateNew={handleCreateStarring}
								placeholder="Select starring..."
								searchPlaceholder="Search or create starring..."
								emptyMessage="No starring found"
								allowCreate
							/>
						</div>

						{/* Year & Location - 2 columns */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1">
								<Label className="pl-1">Year</Label>
								<Input
									type="number"
									value={values.year ?? ""}
									onChange={(e) =>
										setValues((v) => ({
											...v,
											year: e.target.value ? Number(e.target.value) : undefined,
										}))
									}
									placeholder="e.g., 2024"
								/>
							</div>
							<div className="space-y-1">
								<Label className="pl-1">Location</Label>
								<Input
									value={values.location || ""}
									onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
									placeholder="Location"
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!canSave} className="w-full sm:w-auto">
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
