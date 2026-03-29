"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiAutocomplete, type AutocompleteOption } from "@/components/ui/multi-autocomplete";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import type { MediaFile } from "@/services/mediaService";
import clientsService from "@/services/clientsService";
import starringsService from "@/services/starringsService";
import { PhotographyService } from "@/services/photographyService";

export type ImageItemCardMode = "photographer" | "category";

export interface Option {
	label: string;
	value: string;
}

export interface BulkAddValues {
	year?: number;
	location?: string;
	// Legacy string fields (deprecated, kept for backward compatibility)
	client?: string;
	// New relation IDs
	clientIds?: number[];
	starringIds?: number[];
	categoryIds?: number[];
	categoryId?: number;
	photographerId?: number;
}

// Per-file data including title and optional category/photographer
export interface FileWithTitle {
	file: MediaFile;
	title: string;
	categoryIds?: number[];
	photographerId?: number;
}

interface BulkAddPhotographyModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	files: MediaFile[];
	mode: ImageItemCardMode;
	options: Option[];
	onSubmit: (filesWithTitles: FileWithTitle[], commonValues: BulkAddValues) => Promise<void>;
	onRemoveFile?: (fileId: number) => void;
}

export function BulkAddPhotographyModal({
	open,
	onOpenChange,
	files,
	mode,
	options,
	onSubmit,
	onRemoveFile,
}: BulkAddPhotographyModalProps) {
	const queryClient = useQueryClient();
	const [values, setValues] = React.useState<BulkAddValues>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	// Store files with their individual titles
	const [filesWithTitles, setFilesWithTitles] = React.useState<FileWithTitle[]>([]);

	// Search state for autocomplete
	const [clientSearch, setClientSearch] = React.useState("");
	const [starringSearch, setStarringSearch] = React.useState("");
	const [categorySearch, setCategorySearch] = React.useState("");

	// Selected entities state
	const [selectedClients, setSelectedClients] = React.useState<AutocompleteOption[]>([]);
	const [selectedStarrings, setSelectedStarrings] = React.useState<AutocompleteOption[]>([]);
	const [selectedCategories, setSelectedCategories] = React.useState<AutocompleteOption[]>([]);

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

	const { data: categoryOptionsSearch = [] } = useQuery({
		queryKey: ["categories-search", categorySearch],
		queryFn: () => PhotographyService.searchCategories(categorySearch || "", 20),
		staleTime: 30000,
	});

	// Helper to generate default title from filename
	const getDefaultTitle = (file: MediaFile): string => {
		const name = file.originalName || file.filename || "";
		// Remove extension and replace underscores/dashes with spaces
		return name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
	};

	// Sync local files when prop changes
	React.useEffect(() => {
		setFilesWithTitles(
			files.map((file) => ({
				file,
				title: getDefaultTitle(file),
			})),
		);
	}, [files]);

	// Reset form when modal opens
	React.useEffect(() => {
		if (open) {
			setValues({});
			setFilesWithTitles(
				files.map((file) => ({
					file,
					title: getDefaultTitle(file),
				})),
			);
			// Reset selected entities
			setSelectedClients([]);
			setSelectedStarrings([]);
			setSelectedCategories([]);
			setPerFileCategories({});
		}
	}, [open, files]);

	const handleRemoveFile = (fileId: number) => {
		setFilesWithTitles((prev) => {
			const newList = prev.filter((f) => f.file.id !== fileId);
			// Auto-close modal if all items are removed
			if (newList.length === 0) {
				onOpenChange(false);
			}
			return newList;
		});
		onRemoveFile?.(fileId);
	};

	const handleTitleChange = (fileId: number, newTitle: string) => {
		setFilesWithTitles((prev) => prev.map((item) => (item.file.id === fileId ? { ...item, title: newTitle } : item)));
	};

	const handleItemOptionChange = (fileId: number, optionValue: number) => {
		setFilesWithTitles((prev) =>
			prev.map((item) => (item.file.id === fileId ? { ...item, photographerId: optionValue } : item)),
		);
	};

	// Handle per-file category changes (for photographer mode)
	const handleItemCategoriesChange = (fileId: number, categories: AutocompleteOption[]) => {
		setFilesWithTitles((prev) =>
			prev.map((item) => (item.file.id === fileId ? { ...item, categoryIds: categories.map((c) => c.id) } : item)),
		);
	};

	// Per-file selected categories state
	const [perFileCategories, setPerFileCategories] = React.useState<Record<number, AutocompleteOption[]>>({});

	// Handle entity selection changes
	const handleClientsChange = (clients: AutocompleteOption[]) => {
		setSelectedClients(clients);
		setValues((v) => ({ ...v, clientIds: clients.map((c) => c.id) }));
	};

	const handleStarringsChange = (starrings: AutocompleteOption[]) => {
		setSelectedStarrings(starrings);
		setValues((v) => ({ ...v, starringIds: starrings.map((s) => s.id) }));
	};

	const handleCategoriesChange = (categories: AutocompleteOption[]) => {
		setSelectedCategories(categories);
		setValues((v) => ({ ...v, categoryIds: categories.map((c) => c.id) }));
	};

	// Create new entity handlers
	const handleCreateClient = async (name: string): Promise<AutocompleteOption> => {
		const created = await clientsService.findOrCreateClient(name);
		await queryClient.invalidateQueries({ queryKey: ["clients-search"] });
		return { id: created.id, name: created.name };
	};

	const handleCreateStarring = async (name: string): Promise<AutocompleteOption> => {
		const created = await starringsService.findOrCreateStarring(name);
		await queryClient.invalidateQueries({ queryKey: ["starrings-search"] });
		return { id: created.id, name: created.name };
	};

	const handleCreateCategory = async (name: string): Promise<AutocompleteOption> => {
		const created = await PhotographyService.findOrCreateCategory(name);
		await queryClient.invalidateQueries({ queryKey: ["categories-search"] });
		return { id: created.id, name: created.name };
	};

	// Check if all files have their required option selected
	const allFilesHaveOption = filesWithTitles.every((item) =>
		mode === "photographer" ? (item.categoryIds?.length ?? 0) > 0 : !!item.photographerId,
	);

	const canSave = filesWithTitles.length > 0 && allFilesHaveOption;

	const handleSave = async () => {
		if (!canSave) return;
		setIsSubmitting(true);
		try {
			await onSubmit(filesWithTitles, values);
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Add {filesWithTitles.length} Images</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden min-h-0">
					{/* Left side - Selected images with individual titles and categories */}
					<div className="flex flex-col min-h-0 overflow-hidden md:max-h-[400px]">
						<Label className="mb-2 text-sm font-medium shrink-0">Images ({filesWithTitles.length})</Label>
						<ScrollArea className="flex-1 border rounded-lg p-3 bg-muted/30 min-h-0">
							<div className="space-y-4 pr-3">
								{filesWithTitles.map((item) => (
									<div key={item.file.id} className="flex gap-3 items-start group">
										{/* Thumbnail */}
										<div className="relative w-16 h-16 shrink-0">
											<div className="relative w-full h-full rounded-md overflow-hidden border bg-muted">
												<Image
													src={
														item.file.images?.thumbnail || item.file.images?.small || item.file.images?.original || ""
													}
													alt={item.file.originalName || "Image"}
													fill
													className="object-cover"
													unoptimized
												/>
											</div>
											<button
												type="button"
												onClick={() => handleRemoveFile(item.file.id)}
												className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
											>
												<X className="w-3 h-3" />
											</button>
										</div>
										{/* Title and Category inputs */}
										<div className="flex-1 min-w-0 space-y-2">
											<Input
												value={item.title}
												onChange={(e) => handleTitleChange(item.file.id, e.target.value)}
												placeholder="Enter title..."
												className="text-sm"
											/>
											{mode === "photographer" ? (
												<MultiAutocomplete
													values={perFileCategories[item.file.id] || []}
													onValuesChange={(categories) => {
														setPerFileCategories((prev) => ({ ...prev, [item.file.id]: categories }));
														handleItemCategoriesChange(item.file.id, categories);
													}}
													options={categoryOptionsSearch.map((c) => ({ id: c.id, name: c.name }))}
													onSearch={setCategorySearch}
													onCreateNew={handleCreateCategory}
													placeholder="Select categories..."
													searchPlaceholder="Search or create category..."
													emptyMessage="No categories found"
													allowCreate
													className="text-sm"
												/>
											) : (
												<Select
													value={String(item.photographerId ?? "")}
													onValueChange={(val) => handleItemOptionChange(item.file.id, Number(val))}
												>
													<SelectTrigger className="text-sm h-8">
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
									</div>
								))}
							</div>
							{filesWithTitles.length === 0 && (
								<div className="text-center text-muted-foreground py-8">No images selected</div>
							)}
						</ScrollArea>
					</div>

					{/* Right side - Common fields */}
					<ScrollArea className="pr-2 md:max-h-[400px]">
						<div className="space-y-4">
							{/* Apply photographer to all - Only show in category mode */}
							{mode === "category" && (
								<div className="space-y-1">
									<Label className="pl-1">Apply Photographer to All</Label>
									<div className="flex gap-2">
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
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="shrink-0"
											disabled={!values.photographerId}
											onClick={() => {
												if (values.photographerId) {
													setFilesWithTitles((prev) =>
														prev.map((item) => ({ ...item, photographerId: values.photographerId })),
													);
												}
											}}
										>
											Apply
										</Button>
									</div>
								</div>
							)}

							{/* Categories (Multi-select) - Only show in photographer mode */}
							{mode === "photographer" && (
								<div className="space-y-1">
									<Label className="pl-1">Categories (applies to all)</Label>
									<div className="flex gap-2">
										<div className="flex-1">
											<MultiAutocomplete
												values={selectedCategories}
												onValuesChange={handleCategoriesChange}
												options={categoryOptionsSearch.map((c) => ({ id: c.id, name: c.name }))}
												onSearch={setCategorySearch}
												onCreateNew={handleCreateCategory}
												placeholder="Select categories..."
												searchPlaceholder="Search or create category..."
												emptyMessage="No categories found"
												allowCreate
											/>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="shrink-0 self-start mt-0.5"
											disabled={selectedCategories.length === 0}
											onClick={() => {
												if (selectedCategories.length > 0) {
													// Apply selected categories to all files
													setFilesWithTitles((prev) =>
														prev.map((item) => ({
															...item,
															categoryIds: selectedCategories.map((c) => c.id),
														})),
													);
													// Update perFileCategories state for UI
													const newPerFileCategories: Record<number, AutocompleteOption[]> = {};
													filesWithTitles.forEach((item) => {
														newPerFileCategories[item.file.id] = [...selectedCategories];
													});
													setPerFileCategories(newPerFileCategories);
												}
											}}
										>
											Apply
										</Button>
									</div>
								</div>
							)}

							{/* Client */}
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

							{/* Year & Location */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<Label className="pl-1">Year</Label>
									<Input
										type="number"
										value={values.year ?? ""}
										onChange={(e) =>
											setValues((v) => ({
												...v,
												year: e.target.value ? parseInt(e.target.value, 10) : undefined,
											}))
										}
										placeholder="e.g. 2024"
									/>
								</div>
								<div className="space-y-1">
									<Label className="pl-1">Location</Label>
									<Input
										value={values.location || ""}
										onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
										placeholder="e.g. Istanbul"
									/>
								</div>
							</div>
						</div>
					</ScrollArea>
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!canSave || isSubmitting}>
						{isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
						Add {filesWithTitles.length} Images
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
