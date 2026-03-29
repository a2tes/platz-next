"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuillEditor, QuillEditorData } from "@/components/content/QuillEditor";
import { PhotographyService, Photographer } from "@/services/photographyService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";

const photographerSchema = z.object({
	title: z.string().min(1, "Title is required").max(191),
	bio: z.string().optional(), // Now stores JSON string of Quill data
	tags: z.string().optional(),
	avatarId: z.number().nullable().optional(),
	coverImageId: z.number().nullable().optional(),
	previewImageId: z.number().nullable().optional(),
	groupByClient: z.boolean(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
});

type PhotographerFormData = z.infer<typeof photographerSchema>;

// Parse bio from string to QuillEditorData or string (for migration)
function parseBio(bio?: string): QuillEditorData | string | undefined {
	if (!bio) return undefined;
	try {
		const parsed = JSON.parse(bio);
		// Check if it's Quill format
		if (parsed && typeof parsed === "object" && "format" in parsed && parsed.format === "quill") {
			return parsed as QuillEditorData;
		}
		// EditorJS format - pass as string for conversion in QuillEditor
		if (parsed && typeof parsed === "object" && "blocks" in parsed) {
			return bio;
		}
		// Plain text - wrap in HTML
		return { html: `<p>${bio}</p>`, format: "quill" };
	} catch {
		// If parsing fails, treat as plain text or HTML
		if (bio.trim()) {
			return { html: bio.includes("<") ? bio : `<p>${bio}</p>`, format: "quill" };
		}
		return undefined;
	}
}

interface PhotographerFormProps {
	photographer?: Photographer | null;
	onClose?: () => void;
	onSuccess?: () => void;
}

export const PhotographerForm: React.FC<PhotographerFormProps> = ({ photographer, onClose, onSuccess }) => {
	const isEditing = !!photographer;
	const queryClient = useQueryClient();

	// Quill data state
	const [bioData, setBioData] = React.useState<QuillEditorData | string | undefined>(() => parseBio(photographer?.bio));

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
	} = useForm<PhotographerFormData>({
		resolver: zodResolver(photographerSchema),
		defaultValues: {
			title: photographer?.title || "",
			bio: photographer?.bio || "",
			tags: (photographer?.tags as string[])?.join(", ") || "",
			status: photographer?.status || "DRAFT",
			avatarId: photographer?.avatarId,
			coverImageId: photographer?.coverImageId,
			previewImageId: photographer?.previewImageId,
			groupByClient: photographer?.groupByClient ?? true,
			metaDescription: photographer?.metaDescription || "",
			metaKeywords: photographer?.metaKeywords || "",
		},
	});

	const watchedValues = watch();

	// Handle Quill data change
	const handleBioChange = React.useCallback(
		(data: QuillEditorData) => {
			setBioData(data);
			// Convert to JSON string for form submission
			setValue("bio", JSON.stringify(data));
		},
		[setValue],
	);

	// Refs for croppable media fields
	const avatarRef = React.useRef<CroppableMediaFieldRef>(null);
	const coverRef = React.useRef<CroppableMediaFieldRef>(null);
	const previewRef = React.useRef<CroppableMediaFieldRef>(null);

	// Mutations
	type CreatePhotographerPayload = Parameters<typeof PhotographyService.createPhotographer>[0];
	type UpdatePhotographerPayload = Parameters<typeof PhotographyService.updatePhotographer>[1];

	const createMutation = useMutation({
		mutationFn: (data: CreatePhotographerPayload) => PhotographyService.createPhotographer(data),
		onError: (error: unknown) => {
			let message = "Failed to create photographer";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: UpdatePhotographerPayload) => PhotographyService.updatePhotographer(photographer!.id, data),
		onError: (error: unknown) => {
			let message = "Failed to update photographer";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		},
	});

	const onSubmit = async (data: PhotographerFormData) => {
		try {
			const normalizeId = (v?: number | null) => (v == null ? undefined : v);
			const payload = {
				...data,
				tags: data.tags
					? data.tags
							.split(",")
							.map((t) => t.trim())
							.filter(Boolean)
					: [],
				avatarId: normalizeId(data.avatarId),
				coverImageId: normalizeId(data.coverImageId),
				previewImageId: normalizeId(data.previewImageId),
				groupByClient: data.groupByClient,
			};

			let entityId: number;

			if (isEditing) {
				const updated = await updateMutation.mutateAsync(payload);
				entityId = updated.id;
			} else {
				const created = await createMutation.mutateAsync(payload);
				entityId = created.id;
			}

			// Save all crops in parallel
			await Promise.all([
				avatarRef.current?.saveCrop(entityId),
				coverRef.current?.saveCrop(entityId),
				previewRef.current?.saveCrop(entityId),
			]);

			// Invalidate queries and navigate only after crops are saved
			queryClient.invalidateQueries({ queryKey: ["photographers"] });
			if (isEditing) {
				queryClient.invalidateQueries({ queryKey: ["photographer", photographer!.id] });
			}
			toast.success(isEditing ? "Photographer updated successfully" : "Photographer created successfully");
			onSuccess?.();
		} catch (error) {
			console.error("Form submission error:", error);
		}
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
			{/* Left Column - Main Form Content */}
			<div className="lg:col-span-2 space-y-6">
				{/* Basic Information */}
				<div className="border rounded-xl mb-6">
					<h3 className="text-lg font-semibold border-b p-4">Basic Information</h3>
					<div className="space-y-6 p-4">
						<div>
							<Label htmlFor="title">
								{errors.title ? <span className="text-destructive">{errors.title.message}</span> : "Title *"}
							</Label>
							<Input
								id="title"
								className="mt-3"
								{...register("title")}
								placeholder="You must write the photographer's full name"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<Label htmlFor="bio">
								{errors.bio ? <span className="text-destructive">{errors.bio.message}</span> : "Biography"}
							</Label>
							<div className="mt-3 border rounded-md min-h-50">
								<QuillEditor initialData={bioData} onChange={handleBioChange} />
							</div>
						</div>

						<div>
							<Label htmlFor="tags">Tags</Label>
							<Input
								id="tags"
								className="mt-3"
								{...register("tags")}
								placeholder="Enter tags separated by commas"
								disabled={isSubmitting}
							/>
						</div>
					</div>
				</div>

				{/* Media */}
				<div className="border rounded-xl">
					<h3 className="text-lg font-semibold border-b p-4">Media</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
						{/* Avatar */}
						<CroppableMediaField
							ref={avatarRef}
							label="Avatar"
							value={watchedValues.avatarId ?? null}
							onChange={(id) => setValue("avatarId", id)}
							subjectType="Photographer"
							subjectId={photographer?.id}
							previousMediaId={photographer?.avatarId}
							usageKey="avatar"
							aspect={1}
							disabled={isSubmitting}
						/>

						{/* Cover Image */}
						<CroppableMediaField
							ref={coverRef}
							label="Cover Image"
							value={watchedValues.coverImageId ?? null}
							onChange={(id) => setValue("coverImageId", id)}
							subjectType="Photographer"
							subjectId={photographer?.id}
							previousMediaId={photographer?.coverImageId}
							usageKey="cover"
							aspect={16 / 9}
							disabled={isSubmitting}
						/>
					</div>
				</div>
			</div>

			{/* Right Column - Status & SEO */}
			<div className="lg:col-span-1">
				<div className="grid space-y-6">
					{/* Status */}
					<div className="border rounded-xl overflow-hidden order-3 lg:order-1">
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
						<div className="p-4 space-y-2 flex gap-4">
							<Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
								Cancel
							</Button>

							<Button
								type="submit"
								variant={watchedValues.status === "PUBLISHED" ? "publish" : "default"}
								className="flex-1"
								disabled={isSubmitting || updateMutation.isPending}
							>
								{isSubmitting
									? isEditing
										? "Updating..."
										: watchedValues.status === "PUBLISHED"
											? "Publishing..."
											: "Saving..."
									: isEditing
										? "Update"
										: watchedValues.status === "PUBLISHED"
											? "Publish"
											: "Save as Draft"}
							</Button>
						</div>
					</div>
					{/* Presentation Style */}
					<div className="border rounded-xl overflow-hidden order-1 lg:order-2">
						<h3 className="text-lg font-semibold border-b p-4">Presentation Style</h3>
						<div className="p-4 space-y-3">
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="radio"
									name="presentationStyle"
									checked={!watchedValues.groupByClient}
									onChange={() => setValue("groupByClient", false)}
									className="w-4 h-4 text-primary"
								/>
								<div>
									<span className="font-medium">Single Feed</span>
									<p className="text-sm text-muted-foreground">All photos displayed in a continuous masonry grid</p>
								</div>
							</label>
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="radio"
									name="presentationStyle"
									checked={watchedValues.groupByClient}
									onChange={() => setValue("groupByClient", true)}
									className="w-4 h-4 text-primary"
								/>
								<div>
									<span className="font-medium">Client Groups</span>
									<p className="text-sm text-muted-foreground">Photos grouped by client as clickable cards</p>
								</div>
							</label>
						</div>
					</div>

					{/* SEO & Social Media */}
					<div className="border rounded-xl order-2 lg:order-3 mb-6">
						<h3 className="text-lg font-semibold border-b p-4">SEO & Social Media</h3>
						<div className="space-y-4 p-4">
							{/* Preview Image */}
							<CroppableMediaField
								ref={previewRef}
								label="Preview Image"
								value={watchedValues.previewImageId ?? null}
								onChange={(id) => setValue("previewImageId", id)}
								subjectType="Photographer"
								subjectId={photographer?.id}
								previousMediaId={photographer?.previewImageId}
								usageKey="preview"
								aspect={2}
								disabled={isSubmitting}
							/>

							<div>
								<Label htmlFor="metaDescription">Meta Description</Label>
								<Textarea
									id="metaDescription"
									className="mt-3 min-h-25"
									{...register("metaDescription")}
									placeholder="Enter meta description"
									disabled={isSubmitting}
								/>
							</div>

							<div>
								<Label htmlFor="metaKeywords">Meta Keywords</Label>
								<Input
									id="metaKeywords"
									className="mt-3"
									{...register("metaKeywords")}
									placeholder="Enter keywords separated by commas"
									disabled={isSubmitting}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</form>
	);
};
