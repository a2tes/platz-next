"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPhoto, IconPhotoOff, IconX } from "@tabler/icons-react";
import { MediaService, MediaFile } from "@/services/mediaService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CropperModal } from "@/components/media/CropperModal";

export type StagedCrop = {
	mediaId: number;
	x: number;
	y: number;
	w: number;
	h: number;
};

// Imperative handle exposed via ref
export interface CroppableMediaFieldRef {
	/** Save or delete the crop. Pass subjectId for new entities. */
	saveCrop: (subjectId?: number) => Promise<void>;
	/** Reset staged state */
	reset: () => void;
	/** Check if there's a pending crop or deletion */
	hasPendingChanges: boolean;
}

interface CroppableMediaFieldProps {
	label: string;
	value?: number | null;
	onChange: (id: number | null) => void;
	subjectType: string;
	subjectId?: number;
	usageKey: string;
	aspect: number;
	disabled?: boolean;
	/** Previous media ID for tracking deletions (pass the original entity's media ID) */
	previousMediaId?: number | null;

	// Legacy props - still supported but deprecated
	/** @deprecated Use ref.saveCrop() instead */
	onCropStaged?: (crop: StagedCrop | null) => void;
	/** @deprecated Use ref.reset() instead */
	resetSignal?: number;
}

export const CroppableMediaField = React.forwardRef<CroppableMediaFieldRef, CroppableMediaFieldProps>(
	(
		{
			label,
			value,
			onChange,
			subjectType,
			subjectId,
			usageKey,
			aspect,
			disabled,
			previousMediaId,
			onCropStaged,
			resetSignal,
		},
		ref,
	) => {
		const queryClient = useQueryClient();

		const { data: file } = useQuery({
			queryKey: ["media-file", value],
			queryFn: () => MediaService.getFile(value!),
			enabled: !!value,
		});

		// Fetch server crop data for existing entities
		const { data: serverCrop } = useQuery({
			queryKey: ["media-crop", subjectType, subjectId, usageKey],
			queryFn: () =>
				MediaService.getCropBySubject({
					subjectType,
					subjectId: subjectId!,
					usageKey,
				}),
			enabled: !!subjectId && !!value,
		});

		const [error, setError] = React.useState(false);
		const [cropperOpen, setCropperOpen] = React.useState(false);
		const [selectedFile, setSelectedFile] = React.useState<MediaFile | null>(null);
		const [stagedCrop, setStagedCrop] = React.useState<StagedCrop | null>(null);
		const [stagedPreviewVersion, setStagedPreviewVersion] = React.useState(0);
		const [serverCropVersion, setServerCropVersion] = React.useState(0);
		const [mediaWasCleared, setMediaWasCleared] = React.useState(false);

		// Expose a small API to parent via onCropStaged (legacy)
		const updateStaged = React.useCallback(
			(crop: StagedCrop | null) => {
				setStagedCrop(crop);
				onCropStaged?.(crop);
				setStagedPreviewVersion((v) => v + 1);
			},
			[onCropStaged],
		);

		// Expose imperative handle via ref
		React.useImperativeHandle(
			ref,
			() => ({
				saveCrop: async (resolvedSubjectId?: number) => {
					const effectiveSubjectId = subjectId ?? resolvedSubjectId;
					if (!effectiveSubjectId) {
						console.warn("CroppableMediaField: No subjectId available for saveCrop");
						return;
					}

					// Handle deletion: media was removed
					if (!value && mediaWasCleared && previousMediaId) {
						await MediaService.deleteCrop({
							mediaId: previousMediaId,
							subjectType,
							subjectId: effectiveSubjectId,
							usageKey,
						});
						setMediaWasCleared(false);
						// Invalidate crop query after deletion
						queryClient.invalidateQueries({
							queryKey: ["media-crop", subjectType, effectiveSubjectId, usageKey],
						});
						return;
					}

					// Handle upsert: staged crop exists
					if (stagedCrop && value) {
						await MediaService.upsertCrop({
							mediaId: stagedCrop.mediaId,
							subjectType,
							subjectId: effectiveSubjectId,
							usageKey,
							x: Math.round(stagedCrop.x),
							y: Math.round(stagedCrop.y),
							w: Math.round(stagedCrop.w),
							h: Math.round(stagedCrop.h),
						});

						// Auto-reset after save and invalidate query to refetch server crop
						setStagedCrop(null);
						setServerCropVersion((v) => v + 1);
						queryClient.invalidateQueries({
							queryKey: ["media-crop", subjectType, effectiveSubjectId, usageKey],
						});
					}
				},
				reset: () => {
					setStagedCrop(null);
					setServerCropVersion((v) => v + 1);
					setMediaWasCleared(false);
				},
				get hasPendingChanges() {
					return stagedCrop !== null || mediaWasCleared;
				},
			}),
			[stagedCrop, value, subjectType, subjectId, usageKey, previousMediaId, mediaWasCleared, queryClient],
		);

		const { openSelectorModal } = useMediaLibraryStore.getState();

		const handleOpenSelector = () => {
			if (disabled) return;
			openSelectorModal("image", (file: MediaFile) => {
				setError(false);
				onChange(file.id);
				setSelectedFile(file);
				setCropperOpen(true);
			});
		};

		const handleDelete = (e: React.MouseEvent) => {
			e.stopPropagation();
			setMediaWasCleared(true);
			onChange(null);
			setSelectedFile(null);
			updateStaged(null);
			setServerCropVersion((v) => v + 1);
		};

		// Base output width for previews
		const baseWidth = 1280;

		const src = React.useMemo(() => {
			if (!file?.uuid) return undefined;

			// Use image provider for all crop operations
			if (stagedCrop) {
				// Staged crop - use the staged values
				const outputHeight = Math.round(baseWidth / (stagedCrop.w / stagedCrop.h));
				return MediaService.buildImageUrl({
					uuid: file.uuid,
					crop: {
						x: Math.round(stagedCrop.x),
						y: Math.round(stagedCrop.y),
						w: Math.round(stagedCrop.w),
						h: Math.round(stagedCrop.h),
					},
					w: baseWidth,
					h: outputHeight,
					q: 82,
					format: "webp",
				});
			}

			// Server crop exists - use it
			if (serverCrop && serverCrop.x != null) {
				const outputHeight = Math.round(baseWidth / aspect);
				return MediaService.buildImageUrl({
					uuid: file.uuid,
					crop: {
						x: serverCrop.x,
						y: serverCrop.y,
						w: serverCrop.w,
						h: serverCrop.h,
					},
					w: baseWidth,
					h: outputHeight,
					q: 82,
					format: "webp",
				});
			}

			// No crop - use thumbnail
			return file.images.medium || file.images.thumbnail;
		}, [file, stagedCrop, serverCrop, aspect, serverCropVersion]);

		// Reset staged crop when parent requests
		React.useEffect(() => {
			if (resetSignal === undefined) return;
			// Clear staged and force reload server crop
			setStagedCrop(null);
			setServerCropVersion((v) => v + 1);
		}, [resetSignal]);

		return (
			<div>
				<Label>{label}</Label>
				<div
					className="mt-3 bg-muted rounded-md flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors relative overflow-hidden"
					style={{ aspectRatio: aspect }}
					onClick={handleOpenSelector}
				>
					{file && !error ? (
						<>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={src} alt={label} className="w-full object-cover" onError={() => setError(true)} />
							<Button
								size="sm"
								variant="secondary"
								className="absolute top-2 right-2 rounded-xl"
								onClick={handleDelete}
								disabled={disabled}
							>
								<IconX className="h-4 w-4" />
							</Button>
						</>
					) : (
						<div className="text-center p-4">
							{error ? (
								<IconPhotoOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
							) : (
								<IconPhoto className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
							)}
							<p className="text-sm text-muted-foreground">Choose</p>
						</div>
					)}
				</div>

				{cropperOpen && selectedFile && (
					<CropperModal
						imageUrl={selectedFile?.images?.original || ""}
						aspect={aspect}
						title={`Crop ${label}`}
						onCancel={() => {
							setCropperOpen(false);
							setSelectedFile(null);
						}}
						onSave={(area) => {
							if (!selectedFile) return;
							updateStaged({
								mediaId: selectedFile.id,
								x: Math.round(area.x),
								y: Math.round(area.y),
								w: Math.round(area.width),
								h: Math.round(area.height),
							});
							setCropperOpen(false);
							setSelectedFile(null);
						}}
					/>
				)}
			</div>
		);
	},
);

CroppableMediaField.displayName = "CroppableMediaField";
