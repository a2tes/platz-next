"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconX, IconColumns, IconList } from "@tabler/icons-react";
import { AnimationRevision, Animation } from "@/services/animationsService";
import { getTimeAgo } from "@/lib/utils";

interface AnimationRevisionsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	revisions: AnimationRevision[];
	animation?: Animation;
	onRevert: (revisionId: number) => void;
	isLoading?: boolean;
}

// Helper to format field names
function formatFieldName(field: string): string {
	const fieldNameMap: Record<string, string> = {
		title: "Title",
		shortDescription: "Short Description",
		client: "Client",
		tags: "Tags",
		videoFileId: "Video File",
		metaDescription: "Meta Description",
		metaKeywords: "Meta Keywords",
		previewImageId: "Preview Image",
		status: "Status",
		sortOrder: "Sort Order",
		publishedAt: "Published At",
	};
	return fieldNameMap[field] || field;
}

// Helper to format field values
function formatFieldValue(
	value: unknown,
	fieldName: string,
	animation?: Animation,
	payload?: Record<string, unknown>
): string {
	if (value === null || value === undefined) return "—";

	// Handle media file IDs - first check payload for *Name fields, then fall back to animation object
	if (typeof value === "number") {
		if (fieldName === "videoFileId") {
			const nameFromPayload = payload?.["videoFileName"];
			if (nameFromPayload && typeof nameFromPayload === "string") {
				return nameFromPayload;
			}
			return animation?.videoFile?.originalName || String(value);
		}
		if (fieldName === "previewImageId") {
			const nameFromPayload = payload?.["previewImageName"];
			if (nameFromPayload && typeof nameFromPayload === "string") {
				return nameFromPayload;
			}
			return animation?.previewImage?.originalName || String(value);
		}
	}

	if (Array.isArray(value)) {
		if (value.length === 0) return "—";

		// Handle objects in array (like gallery items)
		if (value.length > 0 && typeof value[0] === "object") {
			const items = value as Array<{ originalName?: string; id?: number }>;
			if (items[0]?.originalName) {
				return items.map((item) => item.originalName || `Item ${item.id}`).join(", ");
			}
			return `${value.length} item${value.length > 1 ? "s" : ""}`;
		}

		return value.join(", ");
	}
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "object") return "—";
	return String(value);
}

export function AnimationRevisionsModal({
	open,
	onOpenChange,
	revisions,
	animation,
	onRevert,
	isLoading,
}: AnimationRevisionsModalProps) {
	const [selectedRevisionId, setSelectedRevisionId] = React.useState<number | null>(null);
	const [compareMode, setCompareMode] = React.useState(false);

	const visibleRevisions = revisions;

	const latestRevision = visibleRevisions.length > 0 ? visibleRevisions[0] : null;

	React.useEffect(() => {
		if (open && visibleRevisions.length > 0 && !selectedRevisionId) {
			setSelectedRevisionId(visibleRevisions[0].id);
			setCompareMode(true);
		}
	}, [open, visibleRevisions, selectedRevisionId]);

	React.useEffect(() => {
		if (!open) {
			setSelectedRevisionId(null);
			setCompareMode(false);
		}
	}, [open]);

	const selectedRevision = selectedRevisionId ? visibleRevisions.find((r) => r.id === selectedRevisionId) : null;
	const selectedIndex = selectedRevision ? visibleRevisions.findIndex((r) => r.id === selectedRevisionId) : -1;
	const previousRevision = selectedIndex < visibleRevisions.length - 1 ? visibleRevisions[selectedIndex + 1] : null;

	const v0Revision = revisions.find((r) => r.version === 0);
	const effectivePreviousRevision = previousRevision || v0Revision || null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[80vh]">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle>Revision History</DialogTitle>
						<div className="flex items-center gap-2">
							{selectedRevision && selectedRevision.version !== 0 && (
								<>
									<Button
										size="sm"
										variant={compareMode ? "default" : "ghost"}
										onClick={() => setCompareMode(true)}
										className="h-8 w-8 p-0"
									>
										<IconColumns className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant={!compareMode ? "default" : "ghost"}
										onClick={() => setCompareMode(false)}
										className="h-8 w-8 p-0"
									>
										<IconList className="h-4 w-4" />
									</Button>
								</>
							)}
							<Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="h-8 w-8 p-0">
								<IconX className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</DialogHeader>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
					{/* List of revisions */}
					<div className="lg:col-span-1 border-r pr-4 max-h-[60vh] overflow-y-auto">
						<p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Versions</p>
						<div className="space-y-2">
							{visibleRevisions.map((revision) => (
								<button
									key={revision.id}
									onClick={() => {
										setSelectedRevisionId(revision.id);
										setCompareMode(revision.version !== 0);
									}}
									className={`w-full text-left p-2 rounded-md transition-colors text-sm ${
										selectedRevisionId === revision.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
									}`}
								>
									<div className="flex items-center justify-between">
										<span className="font-medium">
											{revision.version === 0 ? "Initial State" : `Version ${revision.version}`}
										</span>
										{latestRevision && revision.id === latestRevision.id && (
											<Badge variant="default" className="bg-green-600 text-xs">
												Current
											</Badge>
										)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">{getTimeAgo(revision.createdAt)}</p>
									{revision.revertedFromId && (
										<p className="text-xs text-muted-foreground mt-1 italic">
											Reverted from Version&nbsp;
											{visibleRevisions.find((r) => r.id === revision.revertedFromId)?.version}
										</p>
									)}
								</button>
							))}
						</div>
					</div>

					{/* Content area */}
					<div className="lg:col-span-2 max-h-[60vh] overflow-y-auto">
						{!selectedRevision ? (
							<p className="text-sm text-muted-foreground text-center py-8">Select a version to view details</p>
						) : compareMode && selectedRevision.version !== 0 ? (
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<div className="bg-muted/50 rounded-md p-3 mb-3">
											<p className="text-xs font-semibold mb-2">
												{effectivePreviousRevision?.version === 0
													? "Initial State"
													: effectivePreviousRevision
													? `Version ${effectivePreviousRevision.version}`
													: "Initial State"}
											</p>
											{effectivePreviousRevision && (
												<>
													<p className="text-xs text-muted-foreground">
														{getTimeAgo(effectivePreviousRevision.createdAt)}
													</p>
													{effectivePreviousRevision.user && (
														<p className="text-xs text-muted-foreground mt-1">by {effectivePreviousRevision.user}</p>
													)}
												</>
											)}
										</div>
									</div>

									<div>
										<div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3 mb-3">
											<p className="text-xs font-semibold mb-2">
												Version {selectedRevision.version}
												{selectedRevision.revertedFromId && (
													<span className="ml-2 text-muted-foreground font-normal italic">
														(reverted from Ver.
														{visibleRevisions.find((r) => r.id === selectedRevision.revertedFromId)?.version})
													</span>
												)}
											</p>
											<p className="text-xs text-muted-foreground">{getTimeAgo(selectedRevision.createdAt)}</p>
											{selectedRevision.user && (
												<p className="text-xs text-muted-foreground mt-1">by {selectedRevision.user}</p>
											)}
										</div>
									</div>
								</div>

								<div className="border rounded-lg overflow-hidden">
									{(() => {
										const currentPayload =
											typeof selectedRevision.payload === "object" && selectedRevision.payload
												? selectedRevision.payload
												: {};
										const previousPayload =
											effectivePreviousRevision &&
											typeof effectivePreviousRevision.payload === "object" &&
											effectivePreviousRevision.payload
												? effectivePreviousRevision.payload
												: {};

										const allKeys = new Set([...Object.keys(currentPayload), ...Object.keys(previousPayload)]);

										const changes = Array.from(allKeys)
											.filter((key) => !key.endsWith("Name") && !key.endsWith("Names"))
											.map((key) => {
												const newValue = (currentPayload as Record<string, unknown>)[key];
												const oldValue = (previousPayload as Record<string, unknown>)[key];
												const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);

												return { key, newValue, oldValue, hasChanged };
											})
											.filter((item) => item.hasChanged);

										if (changes.length === 0) {
											return <p className="text-sm text-muted-foreground text-center py-4">No changes detected</p>;
										}

										return changes.map((item) => (
											<div
												key={item.key}
												className="grid grid-cols-2 gap-4 p-3 border-b last:border-b-0 bg-yellow-50 dark:bg-yellow-950"
											>
												<div>
													<p className="text-xs font-semibold text-muted-foreground mb-1">
														{formatFieldName(item.key)}
													</p>
													<p className="text-sm line-through opacity-50">
														{formatFieldValue(
															item.oldValue,
															item.key,
															animation,
															previousPayload as Record<string, unknown>
														)}
													</p>
												</div>
												<div>
													<p className="text-xs font-semibold text-muted-foreground mb-1">→</p>
													<p className="text-sm font-medium text-foreground">
														{formatFieldValue(
															item.newValue,
															item.key,
															animation,
															currentPayload as Record<string, unknown>
														)}
													</p>
												</div>
											</div>
										));
									})()}
								</div>

								{latestRevision && selectedRevision.id !== latestRevision.id && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => onRevert(selectedRevision.id)}
										disabled={isLoading}
										className="w-full mt-4"
									>
										{isLoading ? "Reverting..." : `Revert to this version`}
									</Button>
								)}
							</div>
						) : (
							<div className="space-y-3">
								<div className="bg-muted/50 rounded-md p-3">
									<div className="flex items-center gap-2 mb-2">
										<span className="font-semibold">
											{selectedRevision.version === 0 ? "Initial Version" : `Version ${selectedRevision.version}`}
										</span>
										{latestRevision && selectedRevision.id === latestRevision.id && (
											<Badge variant="default" className="bg-green-600">
												Current
											</Badge>
										)}
									</div>
									{selectedRevision.revertedFromId && (
										<p className="text-xs text-muted-foreground mb-2 italic">
											Reverted from Version{" "}
											{visibleRevisions.find((r) => r.id === selectedRevision.revertedFromId)?.version}
										</p>
									)}
									<p className="text-sm text-muted-foreground">{getTimeAgo(selectedRevision.createdAt)}</p>
									{selectedRevision.user && (
										<p className="text-xs text-muted-foreground mt-1">by {selectedRevision.user}</p>
									)}
								</div>

								{selectedRevision.payload && (
									<div className="border rounded-lg overflow-hidden">
										<div className="bg-muted/50 p-3 border-b">
											<p className="text-xs font-semibold uppercase">Revision Data</p>
										</div>
										{typeof selectedRevision.payload === "object" &&
											Object.entries(selectedRevision.payload)
												.filter(([key, value]) => {
													if (key.endsWith("Name") || key.endsWith("Names")) {
														return false;
													}
													if (value === null || value === undefined) {
														return false;
													}
													if (Array.isArray(value) && value.length === 0) {
														return false;
													}
													if (value === "") {
														return false;
													}
													const formatted = formatFieldValue(
														value,
														key,
														animation,
														selectedRevision.payload as Record<string, unknown>
													);
													if (formatted === "—") {
														return false;
													}
													return true;
												})
												.map(([key, value]) => (
													<div key={key} className="grid grid-cols-3 gap-4 p-3 border-b last:border-b-0">
														<div className="col-span-1">
															<p className="text-xs font-semibold text-muted-foreground">{formatFieldName(key)}</p>
														</div>
														<div className="col-span-2">
															<p className="text-sm">
																{formatFieldValue(
																	value,
																	key,
																	animation,
																	selectedRevision.payload as Record<string, unknown>
																)}
															</p>
														</div>
													</div>
												))}
									</div>
								)}

								{latestRevision && selectedRevision.id !== latestRevision.id && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => onRevert(selectedRevision.id)}
										disabled={isLoading}
										className="w-full"
									>
										{isLoading ? "Reverting..." : `Revert to this version`}
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
