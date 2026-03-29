"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconX, IconVideo, IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { WorksService, Work, CreateWorkData, UpdateWorkData } from "../../services/worksService";
import { MediaService, MediaFile } from "../../services/mediaService";
import { clientsService } from "../../services/clientsService";
import { agenciesService } from "../../services/agenciesService";
import { disciplinesService } from "../../services/disciplinesService";
import { sectorsService } from "../../services/sectorsService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiAutocomplete, type AutocompleteOption } from "@/components/ui/multi-autocomplete";
import { RevisionsModal } from "./RevisionsModal";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";
import { QuillEditor } from "@/components/content/QuillEditor";
import Image from "next/image";
import { imgixLoader } from "@/lib/imageLoader";
import { getTimeAgo } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";

const workSchema = z.object({
	title: z.string().min(1, "Title is required").max(191, "Title must be less than 191 characters"),
	shortDescription: z.string().optional(),
	subtitle: z.string().max(255, "Subtitle must be less than 255 characters").optional(),
	caseStudy: z.string().optional(),
	client: z.string().max(191, "Client must be less than 191 characters").optional(), // @deprecated
	agency: z.string().max(191, "Agency must be less than 191 characters").optional(), // @deprecated
	tags: z.string(),
	videoFileId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
	directorIds: z.array(z.number()),
	starringIds: z.array(z.number()),
	clientIds: z.array(z.number()).optional(),
	agencyIds: z.array(z.number()).optional(),
	disciplineIds: z.array(z.number()).optional(),
	sectorIds: z.array(z.number()).optional(),
});

type WorkFormData = z.infer<typeof workSchema>;

interface WorkFormProps {
	work?: Work | null;
	onClose: () => void;
	onSuccess: () => void;
}

type MediaSelectionType = "video" | "previewImage";

export const WorkForm: React.FC<WorkFormProps> = ({ work, onClose, onSuccess }) => {
	const isEditing = !!work;
	const queryClient = useQueryClient();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
		reset,
	} = useForm<WorkFormData>({
		resolver: zodResolver(workSchema),
		defaultValues: {
			title: work?.title || "",
			shortDescription: work?.shortDescription || "",
			subtitle: work?.subtitle || "",
			caseStudy: work?.caseStudy || "",
			client: work?.client || "",
			agency: work?.agency || "",
			tags: work?.tags.join(", ") || "",
			status: work?.status || "DRAFT",
			directorIds: work?.directors.map((d) => d.director.id) || [],
			starringIds: work?.starrings.map((s) => s.starring.id) || [],
			clientIds: work?.clients?.map((c: any) => c.client.id) || [],
			agencyIds: work?.agencies?.map((a: any) => a.agency.id) || [],
			disciplineIds: work?.disciplines?.map((d: any) => d.discipline.id) || [],
			sectorIds: work?.sectors?.map((s: any) => s.sector.id) || [],
			videoFileId: work?.videoFileId,
			previewImageId: work?.previewImageId,
			metaDescription: work?.metaDescription || "",
			metaKeywords: work?.metaKeywords || "",
		},
	});

	const watchedValues = watch();
	const [showRevisions, setShowRevisions] = React.useState(false);

	// Ref for croppable media field
	const previewRef = React.useRef<CroppableMediaFieldRef>(null);

	// Reset form when work data changes (e.g., after revert)
	React.useEffect(() => {
		if (work && isEditing) {
			reset({
				title: work.title,
				shortDescription: work.shortDescription || "",
				subtitle: work.subtitle || "",
				caseStudy: work.caseStudy || "",
				client: work.client,
				agency: work.agency || "",
				tags: work.tags.join(", "),
				status: work.status,
				directorIds: (work.directors || []).map((d) => d.director.id),
				starringIds: (work.starrings || []).map((s) => s.starring.id),
				clientIds: (work.clients || []).map((c: any) => c.client.id),
				agencyIds: (work.agencies || []).map((a: any) => a.agency.id),
				disciplineIds: (work.disciplines || []).map((d: any) => d.discipline.id),
				sectorIds: (work.sectors || []).map((s: any) => s.sector.id),
				videoFileId: work.videoFileId,
				previewImageId: work.previewImageId,
				metaDescription: work.metaDescription || "",
				metaKeywords: work.metaKeywords || "",
			});
		}
	}, [work, isEditing, reset]);

	// No-op

	// Fetch directors and starrings
	const { data: directorsData } = useQuery({
		queryKey: ["directors"],
		queryFn: () => WorksService.getDirectors({ limit: 100 }),
	});

	const { data: starringsData } = useQuery({
		queryKey: ["starrings"],
		queryFn: () => WorksService.getStarrings({ limit: 100 }),
	});

	// Fetch all clients and agencies once
	const { data: clientsData } = useQuery({
		queryKey: ["clients"],
		queryFn: () => clientsService.getAll(),
		staleTime: Infinity,
	});

	const { data: agenciesData } = useQuery({
		queryKey: ["agencies"],
		queryFn: () => agenciesService.getAll(),
		staleTime: Infinity,
	});

	const { data: disciplinesData } = useQuery({
		queryKey: ["disciplines"],
		queryFn: () => disciplinesService.getAll(),
		staleTime: Infinity,
	});

	const { data: sectorsData } = useQuery({
		queryKey: ["sectors"],
		queryFn: () => sectorsService.getAll(),
		staleTime: Infinity,
	});

	// Local search state for client-side filtering
	const [clientSearch, setClientSearch] = React.useState("");
	const [agencySearch, setAgencySearch] = React.useState("");
	const [disciplineSearch, setDisciplineSearch] = React.useState("");
	const [sectorSearch, setSectorSearch] = React.useState("");

	const filteredClients = React.useMemo(() => {
		const all = (clientsData || []) as any[];
		if (!clientSearch) return all;
		const q = clientSearch.toLowerCase();
		return all.filter((c) => c.name?.toLowerCase().includes(q));
	}, [clientsData, clientSearch]);

	const filteredAgencies = React.useMemo(() => {
		const all = (agenciesData || []) as any[];
		if (!agencySearch) return all;
		const q = agencySearch.toLowerCase();
		return all.filter((a) => a.name?.toLowerCase().includes(q));
	}, [agenciesData, agencySearch]);

	const filteredDisciplines = React.useMemo(() => {
		const all = (disciplinesData || []) as any[];
		if (!disciplineSearch) return all;
		const q = disciplineSearch.toLowerCase();
		return all.filter((d) => d.name?.toLowerCase().includes(q));
	}, [disciplinesData, disciplineSearch]);

	const filteredSectors = React.useMemo(() => {
		const all = (sectorsData || []) as any[];
		if (!sectorSearch) return all;
		const q = sectorSearch.toLowerCase();
		return all.filter((s) => s.name?.toLowerCase().includes(q));
	}, [sectorsData, sectorSearch]);

	const { data: videoFile } = useQuery({
		queryKey: ["media-file", watchedValues.videoFileId],
		queryFn: () => MediaService.getFile(watchedValues.videoFileId!),
		enabled: !!watchedValues.videoFileId,
	});

	// Mutations
	const createMutation = useMutation({
		mutationFn: (data: CreateWorkData) => WorksService.createWork(data),
		onSuccess: () => {
			// Invalidate queries to refresh data
			queryClient.invalidateQueries({ queryKey: ["works"] });
			toast.success("Work created successfully");
			onSuccess();
		},
		onError: (error: unknown) => {
			let message = "Failed to create work";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: UpdateWorkData) => WorksService.updateWork(work!.id, data),
		onSuccess: () => {
			// Invalidate queries to refresh data
			queryClient.invalidateQueries({ queryKey: ["works"] });
			queryClient.invalidateQueries({ queryKey: ["work", work!.id] });
			toast.success("Work updated successfully");
			onSuccess();
		},
		onError: (error: unknown) => {
			let message = "Failed to update work";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		},
	});

	const onSubmit = async (data: WorkFormData) => {
		console.log("Form data submitted:", data);
		try {
			const submitData = {
				...data,
				tags: data.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				clientIds: data.clientIds || [],
				agencyIds: data.agencyIds || [],
				disciplineIds: data.disciplineIds || [],
				sectorIds: data.sectorIds || [],
			};

			let entityId: number;
			if (isEditing) {
				const updated = await updateMutation.mutateAsync(submitData as UpdateWorkData);
				entityId = updated.id;
			} else {
				const created = await createMutation.mutateAsync(submitData as CreateWorkData);
				entityId = created.id;
			}

			// Save any staged crops using the ref-based API
			await previewRef.current?.saveCrop(entityId);
		} catch (error: unknown) {
			let message = "Failed to save work";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		}
	};

	const onError = () => {
		toast.error("Please check the form for errors.");
	};

	const handleMediaSelect = (type: MediaSelectionType) => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		if (type !== "video") return;
		openSelectorModal("video", (file: MediaFile) => {
			setValue("videoFileId", file.id);
		});
	};

	const toggleDirector = (directorId: number) => {
		const current = watchedValues.directorIds || [];
		const updated = current.includes(directorId) ? current.filter((id) => id !== directorId) : [...current, directorId];
		setValue("directorIds", updated);
	};

	const toggleStarring = (starringId: number) => {
		const current = watchedValues.starringIds || [];
		const updated = current.includes(starringId) ? current.filter((id) => id !== starringId) : [...current, starringId];
		setValue("starringIds", updated);
	};

	const handleRevertRevision = async (revisionId: number) => {
		try {
			if (!work?.id) return;

			await WorksService.revertToRevision(work.id, revisionId);

			// Invalidate and refetch queries - React Query will automatically refetch
			await queryClient.invalidateQueries({ queryKey: ["works"] });
			await queryClient.invalidateQueries({ queryKey: ["work", work.id] });

			toast.success("Reverted to selected version");
			setShowRevisions(false);
		} catch (error: unknown) {
			let message = "Failed to revert revision";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		}
	};

	const directors = directorsData?.data || [];
	const starrings = starringsData?.data || [];

	return (
		<>
			<form onSubmit={handleSubmit(onSubmit, onError)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
				{/* Left Column - Main Form Content (No Cards, No Shadow) */}
				<div className="lg:col-span-2 space-y-6">
					{/* Basic Information */}
					<div className="border rounded-xl mb-6">
						<h3 className="text-lg font-semibold border-b p-4">Basic Information</h3>
						<div className="space-y-6 p-4">
							{!isEditing && (
								<div>
									<Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
										{!errors.title ? "Title *" : errors.title.message}
									</Label>
									<Input id="title" className="mt-3" {...register("title")} placeholder="Enter work title" />
								</div>
							)}

							<div>
								<Label htmlFor="subtitle">Subtitle</Label>
								<Input id="subtitle" className="mt-3" {...register("subtitle")} placeholder="Enter subtitle" />
							</div>

							<div>
								<Label htmlFor="shortDescription">Short Description</Label>
								<Textarea
									id="shortDescription"
									className="mt-3"
									{...register("shortDescription")}
									placeholder="Brief description of the work"
									rows={3}
								/>
							</div>

							<div>
								<Label>Case Study</Label>
								<div className="mt-3">
									<QuillEditor
										initialData={
											watchedValues.caseStudy ? { html: watchedValues.caseStudy, format: "quill" } : undefined
										}
										onChange={(data) => setValue("caseStudy", data.html)}
										placeholder="Enter case study text"
									/>
								</div>
							</div>

							{/* New Client Multi-Select */}
							<div>
								<Label>Client</Label>
								<MultiAutocomplete
									single
									options={filteredClients.map((c: any) => ({
										id: c.id,
										name: c.name,
									}))}
									values={(watchedValues.clientIds || [])
										.map((id: number) => {
											const client = (clientsData || []).find((c: any) => c.id === id);
											if (client) return { id: client.id, name: client.name };
											const workClient = (work?.clients || []).find((c: any) => c.client.id === id);
											if (workClient) return { id: workClient.client.id, name: workClient.client.name };
											return null;
										})
										.filter((v): v is AutocompleteOption => v !== null)}
									onValuesChange={(options) =>
										setValue(
											"clientIds",
											options.map((o) => o.id),
										)
									}
									onSearch={setClientSearch}
									onCreateNew={async (name) => {
										const created = await clientsService.findOrCreateClient(name);
										queryClient.invalidateQueries({ queryKey: ["clients"] });
										return { id: created.id, name: created.name };
									}}
									placeholder="Select or create client..."
									searchPlaceholder="Search or create client..."
									emptyMessage="No clients found"
									className="mt-3"
								/>
							</div>

							{/* New Agency Multi-Select */}
							<div>
								<Label>Agency</Label>
								<MultiAutocomplete
									single
									options={filteredAgencies.map((a: any) => ({
										id: a.id,
										name: a.name,
									}))}
									values={(watchedValues.agencyIds || [])
										.map((id: number) => {
											const agency = (agenciesData || []).find((a: any) => a.id === id);
											if (agency) return { id: agency.id, name: agency.name };
											const workAgency = (work?.agencies || []).find((a: any) => a.agency.id === id);
											if (workAgency) return { id: workAgency.agency.id, name: workAgency.agency.name };
											return null;
										})
										.filter((v): v is AutocompleteOption => v !== null)}
									onValuesChange={(options) =>
										setValue(
											"agencyIds",
											options.map((o) => o.id),
										)
									}
									onSearch={setAgencySearch}
									onCreateNew={async (name) => {
										const created = await agenciesService.findOrCreateAgency(name);
										queryClient.invalidateQueries({ queryKey: ["agencies"] });
										return { id: created.id, name: created.name };
									}}
									placeholder="Select or create agency..."
									searchPlaceholder="Search or create agency..."
									emptyMessage="No agencies found"
									className="mt-3"
								/>
							</div>

							{/* Disciplines Multi-Select */}
							<div>
								<Label>Disciplines</Label>
								<MultiAutocomplete
									options={filteredDisciplines.map((d: any) => ({
										id: d.id,
										name: d.name,
									}))}
									values={(watchedValues.disciplineIds || [])
										.map((id: number) => {
											const discipline = (disciplinesData || []).find((d: any) => d.id === id);
											if (discipline) return { id: discipline.id, name: discipline.name };
											const workDiscipline = (work?.disciplines || []).find((d: any) => d.discipline.id === id);
											if (workDiscipline)
												return { id: workDiscipline.discipline.id, name: workDiscipline.discipline.name };
											return null;
										})
										.filter((v): v is AutocompleteOption => v !== null)}
									onValuesChange={(options) =>
										setValue(
											"disciplineIds",
											options.map((o) => o.id),
										)
									}
									onSearch={setDisciplineSearch}
									onCreateNew={async (name) => {
										const created = await disciplinesService.findOrCreateDiscipline(name);
										queryClient.invalidateQueries({ queryKey: ["disciplines"] });
										return { id: created.id, name: created.name };
									}}
									placeholder="Select or create disciplines..."
									searchPlaceholder="Search or create discipline..."
									emptyMessage="No disciplines found"
									className="mt-3"
								/>
							</div>

							{/* Sectors Multi-Select */}
							<div>
								<Label>Sectors</Label>
								<MultiAutocomplete
									options={filteredSectors.map((s: any) => ({
										id: s.id,
										name: s.name,
									}))}
									values={(watchedValues.sectorIds || [])
										.map((id: number) => {
											const sector = (sectorsData || []).find((s: any) => s.id === id);
											if (sector) return { id: sector.id, name: sector.name };
											const workSector = (work?.sectors || []).find((s: any) => s.sector.id === id);
											if (workSector) return { id: workSector.sector.id, name: workSector.sector.name };
											return null;
										})
										.filter((v): v is AutocompleteOption => v !== null)}
									onValuesChange={(options) =>
										setValue(
											"sectorIds",
											options.map((o) => o.id),
										)
									}
									onSearch={setSectorSearch}
									onCreateNew={async (name) => {
										const created = await sectorsService.findOrCreateSector(name);
										queryClient.invalidateQueries({ queryKey: ["sectors"] });
										return { id: created.id, name: created.name };
									}}
									placeholder="Select or create sectors..."
									searchPlaceholder="Search or create sector..."
									emptyMessage="No sectors found"
									className="mt-3"
								/>
							</div>

							<div>
								<Label htmlFor="tags">Tags</Label>
								<Input id="tags" className="mt-3" {...register("tags")} placeholder="Enter tags separated by commas" />
							</div>
						</div>
					</div>

					{/* Media */}
					<div className="border rounded-xl">
						<h3 className="text-lg font-semibold border-b p-4 ">Media</h3>
						<div className="grid grid-cols-1 gap-4 p-4">
							{/* Video File */}
							<div>
								{videoFile ? (
									<div className="group relative">
										<div className="relative aspect-video overflow-hidden rounded-lg border">
											<Image
												src={videoFile.images.medium}
												alt={videoFile.originalName}
												fill
												className="object-cover"
												unoptimized
											/>
											{/* Play icon overlay */}
											<div className="absolute inset-0 flex items-center justify-center">
												<div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
													<IconPlayerPlay className="w-8 h-8 text-white fill-white" />
												</div>
											</div>
										</div>
										{/* Info bar */}
										<div className="absolute bottom-0 left-0 right-0 bg-linear-to-t rounded-b-lg from-black/50 to-transparent p-3 pt-6">
											<p className="text-white text-sm font-medium truncate">{videoFile.originalName}</p>
										</div>
										{/* Action buttons */}
										<div className="absolute top-2 right-2 flex gap-2">
											<Button
												type="button"
												size="sm"
												variant="secondary"
												className="h-8 w-8 p-0"
												onClick={() => handleMediaSelect("video")}
											>
												<IconRefresh className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												size="sm"
												variant="destructive"
												className="h-8 w-8 p-0"
												onClick={() => setValue("videoFileId", null)}
											>
												<IconX className="h-4 w-4" />
											</Button>
										</div>
									</div>
								) : (
									<div
										className="aspect-video bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 hover:border-muted-foreground/40 transition-colors"
										onClick={() => handleMediaSelect("video")}
									>
										<IconVideo className="h-10 w-10 text-muted-foreground mb-2" />
										<p className="text-sm font-medium text-muted-foreground">Select Video</p>
										<p className="text-xs text-muted-foreground/70 mt-1">Click to browse</p>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Directors & Starrings */}
					<div className="border rounded-xl">
						<h3 className="text-lg font-semibold border-b p-4">Directors & Cast</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
							{/* Directors */}
							<div>
								<Label className="justify-between">
									Directors{" "}
									<span className=" text-gray-500 font-normal">
										{watchedValues.directorIds?.length ? `(${watchedValues.directorIds.length} selected)` : ""}
									</span>
								</Label>
								<ScrollArea className="mt-3 space-y-2 border rounded-md p-2">
									<div className="space-y-2 max-h-48">
										{directors.length === 0 ? (
											<p className="text-sm text-muted-foreground text-center py-4">No directors available</p>
										) : (
											directors.map((director) => (
												<div
													key={director.id}
													className={`p-3 rounded-md cursor-pointer transition-colors ${
														(watchedValues.directorIds || []).includes(director.id)
															? "bg-primary text-primary-foreground"
															: "bg-muted hover:bg-muted/80"
													}`}
													onClick={() => toggleDirector(director.id)}
												>
													<p className="font-medium">{director.title}</p>
												</div>
											))
										)}
									</div>
								</ScrollArea>
							</div>

							{/* Starrings */}
							<div>
								<Label className="justify-between">
									Starrings{" "}
									<span className=" text-gray-500 font-normal">
										{watchedValues.starringIds?.length ? `(${watchedValues.starringIds.length} selected)` : ""}
									</span>
								</Label>
								<ScrollArea className="mt-3 space-y-2 border rounded-md p-2">
									<div className="space-y-2 max-h-48">
										{starrings.length === 0 ? (
											<p className="text-sm text-muted-foreground text-center py-4">No starrings available</p>
										) : (
											starrings.map((starring) => (
												<div
													key={starring.id}
													className={`p-3 rounded-md cursor-pointer transition-colors ${
														(watchedValues.starringIds || []).includes(starring.id)
															? "bg-primary text-primary-foreground"
															: "bg-muted hover:bg-muted/80"
													}`}
													onClick={() => toggleStarring(starring.id)}
												>
													<p className="font-medium">{starring.title}</p>
												</div>
											))
										)}
									</div>
								</ScrollArea>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column - Status & SEO (With Cards & Border) */}
				<div className="lg:col-span-1 space-y-6 grid">
					{/* Status Card */}
					<div className="border rounded-xl mb-6 overflow-hidden order-2 lg:order-1">
						<div className="border-b p-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">Status</h3>
							<div className="flex gap-4">
								<span className="text-sm font-medium">{watchedValues.status === "PUBLISHED" ? "Live" : "Draft"}</span>
								<button
									type="button"
									onClick={() => setValue("status", watchedValues.status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
									className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
										watchedValues.status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
											watchedValues.status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
										}`}
									/>
								</button>
							</div>
						</div>
						{/* Revisions info */}
						{isEditing && (work?.revisions?.filter((r) => r.version > 0).length || 0) > 0 && (
							<div className="border-b p-4 flex items-center justify-between bg-muted/30">
								<div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowRevisions(true)}>
									<span className="text-sm font-medium">Revisions</span>
									<span className="text-sm font-medium text-gray-500">
										({work?.revisions?.filter((r) => r.version > 0).length || 0})
									</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-xs text-muted-foreground">
										{isEditing && work?.updatedAt ? `last edited ${getTimeAgo(work.updatedAt)}` : "new work"}
									</span>
								</div>
							</div>
						)}
						<div className="p-4 space-y-4">
							<div className="space-y-2 flex gap-4">
								<Button type="button" variant="outline" className="flex-1" onClick={onClose}>
									Cancel
								</Button>
								<Button
									type="submit"
									variant={watchedValues.status === "PUBLISHED" ? "publish" : "default"}
									className="flex-1"
									disabled={isSubmitting}
								>
									{isSubmitting
										? "Saving..."
										: isEditing
											? "Update Work"
											: watchedValues.status === "PUBLISHED"
												? "Publish"
												: "Save as Draft"}
								</Button>
							</div>
						</div>
					</div>

					{/* SEO Card */}
					<div className="border rounded-xl mb-6 order-1 lg:order-2">
						<h3 className="text-lg font-semibold border-b p-4">SEO & Social Media</h3>
						<div className="p-4 space-y-4">
							{/* Preview Image */}
							<div>
								<CroppableMediaField
									ref={previewRef}
									label="Preview Image"
									value={watchedValues.previewImageId ?? null}
									onChange={(id) => setValue("previewImageId", id)}
									subjectType="Work"
									subjectId={work?.id}
									previousMediaId={work?.previewImageId}
									usageKey="preview"
									aspect={2}
								/>
							</div>
							<div>
								<Label htmlFor="metaDescription">Meta Description</Label>
								<Textarea
									id="metaDescription"
									className="mt-3"
									{...register("metaDescription")}
									placeholder="Enter meta description"
									rows={3}
								/>
							</div>

							<div>
								<Label htmlFor="metaKeywords">Meta Keywords</Label>
								<Input
									id="metaKeywords"
									className="mt-3"
									{...register("metaKeywords")}
									placeholder="Enter keywords separated by commas"
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Revisions Modal */}
				<RevisionsModal
					open={showRevisions}
					onOpenChange={setShowRevisions}
					revisions={work?.revisions || []}
					work={work || undefined}
					onRevert={handleRevertRevision}
					isLoading={false}
				/>
			</form>
		</>
	);
};
