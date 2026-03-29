"use client";

import React from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "../ui/button";
import { IconX } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"; // Dialog primitives

interface CropperModalProps {
	imageUrl: string;
	aspect?: number; // e.g., 16/9
	title?: string;
	onCancel: () => void;
	onSave: (areaPixels: Area) => void;
}

export function CropperModal({
	imageUrl,
	aspect = 16 / 9,
	title = "Crop Image",
	onCancel,
	onSave,
}: CropperModalProps) {
	const [crop, setCrop] = React.useState<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});
	const [zoom, setZoom] = React.useState<number>(1);
	const areaPixelsRef = React.useRef<Area | null>(null);

	const onCropComplete = React.useCallback((_area: Area, areaPixels: Area) => {
		areaPixelsRef.current = areaPixels;
	}, []);

	const handleSave = () => {
		if (areaPixelsRef.current) {
			onSave(areaPixelsRef.current);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle>{title}</DialogTitle>
						<Button
							variant="ghost"
							size="icon"
							onClick={onCancel}
							className="h-8 w-8"
							aria-label="Close"
						>
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>

				<div className="relative w-full h-[60vh] bg-black">
					<Cropper
						image={imageUrl}
						crop={crop}
						zoom={zoom}
						aspect={aspect}
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={onCropComplete}
						restrictPosition={true}
						showGrid={true}
					/>
				</div>

				<div className="p-4 flex items-center justify-between gap-4 border-t">
					<div className="flex items-center gap-3">
						<input
							type="range"
							min={1}
							max={3}
							step={0.01}
							value={zoom}
							className="appearance-none h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer accent-gray-700 dark:accent-gray-400"
							onChange={(e) => setZoom(Number(e.target.value))}
							aria-label="Zoom"
						/>
					</div>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
						<Button type="submit" onClick={handleSave}>
							Save crop
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
