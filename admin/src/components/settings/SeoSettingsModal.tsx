"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageSeoService, PageSeoData } from "@/services/pageSeoService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";
import { MediaLibraryModal } from "@/components/media/MediaLibraryModal";

interface SeoSettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pageKey: string;
	pageTitle: string; // Display name, e.g. "Works", "Homepage"
}

export function SeoSettingsModal({ open, onOpenChange, pageKey, pageTitle }: SeoSettingsModalProps) {
	const queryClient = useQueryClient();
	const croppableRef = React.useRef<CroppableMediaFieldRef>(null);

	const { data: seoData, isLoading } = useQuery({
		queryKey: ["page-seo", pageKey],
		queryFn: () => PageSeoService.getByPageKey(pageKey),
		enabled: open,
	});

	const [title, setTitle] = React.useState("");
	const [metaDescription, setMetaDescription] = React.useState("");
	const [metaKeywords, setMetaKeywords] = React.useState("");
	const [ogImageId, setOgImageId] = React.useState<number | null>(null);
	const [previousOgImageId, setPreviousOgImageId] = React.useState<number | null>(null);

	// Populate form when data loads
	React.useEffect(() => {
		if (seoData) {
			setTitle(seoData.title || "");
			setMetaDescription(seoData.metaDescription || "");
			setMetaKeywords(seoData.metaKeywords || "");
			setOgImageId(seoData.ogImageId ?? null);
			setPreviousOgImageId(seoData.ogImageId ?? null);
		} else if (!isLoading) {
			// Reset for new/empty record
			setTitle("");
			setMetaDescription("");
			setMetaKeywords("");
			setOgImageId(null);
			setPreviousOgImageId(null);
		}
	}, [seoData, isLoading]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			const record = await PageSeoService.upsert(pageKey, {
				title: title || null,
				metaDescription: metaDescription || null,
				metaKeywords: metaKeywords || null,
				ogImageId,
			});
			// Save crop data after we have the record ID
			if (croppableRef.current?.hasPendingChanges && record.id) {
				await croppableRef.current.saveCrop(record.id);
			}
			return record;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["page-seo", pageKey] });
			toast.success("SEO settings saved");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to save SEO settings");
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>SEO Settings — {pageTitle}</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-4 py-4">
						<div>
							<Label htmlFor="seo-title">Page Title</Label>
							<Input
								id="seo-title"
								className="mt-1.5"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder={`${pageTitle} — Platz Agency`}
							/>
							<p className="text-xs text-muted-foreground mt-1">Overrides the browser tab title for this page.</p>
						</div>
						<div>
							<Label htmlFor="seo-description">Meta Description</Label>
							<Textarea
								id="seo-description"
								className="mt-1.5"
								value={metaDescription}
								onChange={(e) => setMetaDescription(e.target.value)}
								placeholder="Enter meta description for search engines"
								rows={3}
							/>
						</div>
						<div>
							<Label htmlFor="seo-keywords">Meta Keywords</Label>
							<Input
								id="seo-keywords"
								className="mt-1.5"
								value={metaKeywords}
								onChange={(e) => setMetaKeywords(e.target.value)}
								placeholder="keyword1, keyword2, keyword3"
							/>
						</div>
						<CroppableMediaField
							ref={croppableRef}
							label="OG Image"
							value={ogImageId}
							onChange={setOgImageId}
							subjectType="PageSeo"
							subjectId={seoData?.id ?? undefined}
							usageKey="ogImage"
							aspect={1200 / 630}
							previousMediaId={previousOgImageId}
						/>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
						{saveMutation.isPending ? (
							<>
								<IconLoader2 className="h-4 w-4 animate-spin mr-2" />
								Saving...
							</>
						) : (
							"Save"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>

			<MediaLibraryModal />
		</Dialog>
	);
}
