"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuillEditor, QuillEditorData } from "./QuillEditor";
import type { ContentPage } from "@/services/contentService";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";

const contentSchema = z.object({
	title: z.string().min(1, "Title is required").max(191),
	mapEmbed: z.string().nullable().optional(),
	metaDescription: z.string().nullable().optional(),
	metaKeywords: z.string().nullable().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "UNLISTED"]),
});

export type ContentFormData = z.infer<typeof contentSchema>;

export interface ContentPageFormProps {
	queryKey: string;
	getPage: () => Promise<ContentPage>;
	updatePage: (payload: {
		title?: string;
		contentBlocks?: QuillEditorData;
		mapEmbed?: string | null;
		metaDescription?: string | null;
		metaKeywords?: string | null;
		previewImageId?: number | null;
		status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
	}) => Promise<ContentPage>;
	editorKeyPrefix: string; // e.g., about/contact/legal
	showMapEmbed?: boolean; // show map embed field (for contact page)
	onClose?: () => void;
	onSuccess?: (data: ContentPage) => void;
}

export function ContentPageForm({
	queryKey,
	getPage,
	updatePage,
	editorKeyPrefix,
	showMapEmbed = false,
	onClose,
	onSuccess,
}: ContentPageFormProps) {
	const queryClient = useQueryClient();
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<ContentFormData>({
		resolver: zodResolver(contentSchema),
		defaultValues: {
			title: "",
			mapEmbed: "",
			metaDescription: "",
			metaKeywords: "",
			previewImageId: null,
			status: "DRAFT",
		},
	});

	const watched = watch();
	const [editorData, setEditorData] = React.useState<QuillEditorData | undefined>(undefined);
	const [initialEditorData, setInitialEditorData] = React.useState<QuillEditorData | string | undefined>(undefined);

	// Ref for croppable media field
	const previewRef = React.useRef<CroppableMediaFieldRef>(null);

	const { data: page } = useQuery<ContentPage>({
		queryKey: ["content", queryKey],
		queryFn: getPage,
	});

	React.useEffect(() => {
		if (page) {
			reset({
				title: page.title,
				mapEmbed: page.mapEmbed ?? "",
				metaDescription: page.metaDescription ?? "",
				metaKeywords: page.metaKeywords ?? "",
				previewImageId: page.previewImage?.id ?? null,
				status: page.status,
			});
			// Handle both Quill and legacy EditorJS formats
			const contentBlocks = (page as ContentPage & { contentBlocks?: QuillEditorData | Record<string, unknown> | null })
				.contentBlocks;
			if (contentBlocks) {
				// Check if it's already Quill format
				if ("format" in contentBlocks && contentBlocks.format === "quill") {
					setInitialEditorData(contentBlocks as QuillEditorData);
				} else {
					// Legacy EditorJS format - pass as string for conversion
					setInitialEditorData(JSON.stringify(contentBlocks));
				}
			}
		}
	}, [page, reset]);

	const updateMutation = useMutation({
		mutationFn: updatePage,
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["content", queryKey] });
			toast.success("Page saved");
			onSuccess?.(data);
		},
		onError: (err: unknown) => {
			const message = err instanceof Error ? err.message : "Update failed";
			toast.error(message);
		},
	});

	const onSubmit = async (data: ContentFormData) => {
		const blocksToSend: QuillEditorData =
			editorData ??
			(typeof initialEditorData === "object" && initialEditorData?.format === "quill"
				? initialEditorData
				: { html: "", format: "quill" });
		const result = await updateMutation.mutateAsync({
			title: data.title,
			contentBlocks: blocksToSend,
			mapEmbed: data.mapEmbed ?? null,
			metaDescription: data.metaDescription ?? null,
			metaKeywords: data.metaKeywords ?? null,
			previewImageId: data.previewImageId ?? null,
			status: data.status,
		});

		// Save crop after page is updated
		if (result?.id) {
			await previewRef.current?.saveCrop(result.id);
		}
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
			{/* Left */}
			<div className="lg:col-span-2 space-y-6">
				<div className="border rounded-xl">
					<h3 className="text-lg font-semibold border-b p-4">Content</h3>
					<div className="space-y-6 p-4">
						<div>
							<Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
								{!errors.title ? "Title *" : errors.title.message}
							</Label>
							<Input id="title" className="mt-3" {...register("title")} />
						</div>
						{showMapEmbed && (
							<div>
								<Label htmlFor="mapEmbed">Map Embed</Label>
								<Textarea
									id="mapEmbed"
									className="mt-3 font-mono text-sm"
									{...register("mapEmbed")}
									placeholder='<iframe src="https://www.google.com/maps/embed?..." ...></iframe>'
									rows={4}
								/>
								<p className="text-xs text-muted-foreground mt-1">Paste Google Maps embed code here</p>
							</div>
						)}
						<div>
							<Label htmlFor="content">Content</Label>
							<div className="mt-3 space-y-3">
								{page ? (
									<QuillEditor
										key={`${editorKeyPrefix}-${page.id}`}
										initialData={initialEditorData}
										onChange={setEditorData}
									/>
								) : (
									<div className="min-h-[200px] border rounded-md bg-muted/20 animate-pulse flex items-center justify-center">
										<span className="text-muted-foreground text-sm">Loading editor...</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Right */}
			<div className="lg:col-span-1 space-y-6 grid">
				{/* Status */}
				<div className="border rounded-xl overflow-hidden order-2 lg:order-1 mt-8 lg:mt-0">
					<div className="border-b p-4 flex items-center justify-between">
						<h3 className="text-lg font-semibold">Status</h3>
						<div className="flex gap-4">
							<span className="text-sm font-medium">{watched.status === "PUBLISHED" ? "Live" : "Draft"}</span>
							<button
								type="button"
								onClick={() => setValue("status", watched.status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
								className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
									watched.status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
								}`}
							>
								<span
									className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
										watched.status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
									}`}
								/>
							</button>
						</div>
					</div>
					<div className="p-4 space-y-4">
						<div className="space-y-2 flex gap-4">
							{onClose && (
								<Button type="button" variant="outline" className="flex-1" onClick={onClose}>
									Cancel
								</Button>
							)}
							<Button
								type="submit"
								variant={watched.status === "PUBLISHED" ? "publish" : "default"}
								className="flex-1"
								disabled={isSubmitting || updateMutation.isPending}
							>
								{isSubmitting || updateMutation.isPending
									? "Saving..."
									: watched.status === "PUBLISHED"
										? "Publish"
										: "Save as Draft"}
							</Button>
						</div>
					</div>
				</div>

				{/* SEO */}
				<div className="border rounded-xl order-1 lg:order-2">
					<h3 className="text-lg font-semibold border-b p-4">SEO & Social Media</h3>
					<div className="p-4 space-y-4">
						{/* Preview Image */}
						<CroppableMediaField
							ref={previewRef}
							label="Preview Image"
							value={watched.previewImageId ?? null}
							onChange={(id) => setValue("previewImageId", id)}
							subjectType="ContentPage"
							subjectId={page?.id}
							previousMediaId={page?.previewImage?.id}
							usageKey="preview"
							aspect={2}
							disabled={isSubmitting}
						/>

						<div>
							<Label htmlFor="metaDescription">Meta Description</Label>
							<Textarea
								id="metaDescription"
								className="mt-3"
								{...register("metaDescription")}
								placeholder="Meta description"
								rows={3}
							/>
						</div>

						<div>
							<Label htmlFor="metaKeywords">Meta Keywords</Label>
							<Input
								id="metaKeywords"
								className="mt-3"
								{...register("metaKeywords")}
								placeholder="Separate with commas"
							/>
						</div>
					</div>
				</div>
			</div>
		</form>
	);
}
