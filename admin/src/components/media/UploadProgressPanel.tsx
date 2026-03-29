"use client";

import * as React from "react";
import { IconCheck, IconX, IconLoader2, IconFolder, IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useUploadStore } from "@/stores/uploadStore";

// Circular progress component
function CircularProgress({
	progress,
	size = 40,
	strokeWidth = 3,
}: {
	progress: number;
	size?: number;
	strokeWidth?: number;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const offset = circumference - (progress / 100) * circumference;

	return (
		<div className="relative" style={{ width: size, height: size }}>
			<svg className="transform -rotate-90" width={size} height={size}>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-muted-foreground/20"
				/>
				{/* Progress circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className="text-primary transition-all duration-300"
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="text-xs font-medium">{Math.round(progress)}%</span>
			</div>
		</div>
	);
}

export function UploadProgressPanel() {
	const [isMinimized, setIsMinimized] = React.useState(false);
	const { uploadingFiles, showUploadProgress, cancelAllUploads } = useUploadStore();

	if (!showUploadProgress || uploadingFiles.length === 0) {
		return null;
	}

	// Calculate overall progress
	const overallProgress =
		uploadingFiles.reduce((acc, f) => {
			if (f.status === "success") return acc + 100;
			if (f.status === "error" || f.status === "cancelled") return acc + 100;
			if (f.status === "uploading") return acc + f.progress;
			return acc;
		}, 0) / uploadingFiles.length;

	// Minimized view - just circular progress
	if (isMinimized) {
		return (
			<div
				className="fixed bottom-4 right-4 z-9999 bg-background border rounded-full shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
				onClick={() => setIsMinimized(false)}
			>
				<CircularProgress progress={overallProgress} size={48} strokeWidth={4} />
			</div>
		);
	}

	return (
		<div className="fixed bottom-4 right-4 z-9999 w-80 bg-background border rounded-lg shadow-lg overflow-hidden">
			<div className="flex items-center justify-between p-3 border-b bg-muted/30">
				<span className="text-sm font-medium">
					Uploading {uploadingFiles.length} file
					{uploadingFiles.length !== 1 ? "s" : ""}
				</span>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
						<IconChevronDown className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={() => {
							cancelAllUploads();
						}}
					>
						<IconX className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<div className="max-h-60 overflow-y-auto">
				{uploadingFiles.map((item, index) => (
					<div key={`${item.file.name}-${index}`} className="flex items-center gap-2 p-2 border-b last:border-b-0">
						{/* Status Icon */}
						<div className="shrink-0">
							{item.status === "pending" && (
								<div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
							)}
							{item.status === "uploading" && <IconLoader2 className="h-4 w-4 animate-spin text-primary" />}
							{item.status === "success" && <IconCheck className="h-4 w-4 text-green-500" />}
							{item.status === "error" && <IconX className="h-4 w-4 text-destructive" />}
							{item.status === "cancelled" && <IconX className="h-4 w-4 text-muted-foreground" />}
						</div>

						{/* File Info */}
						<div className="flex-1 min-w-0">
							<p className="text-sm truncate">{item.file.name}</p>
							<p className="text-xs text-muted-foreground truncate">
								{item.status === "pending" && (
									<>
										<IconFolder className="h-3 w-3 inline mr-1" />
										{item.folderName}
									</>
								)}
								{item.status === "uploading" && (
									<>
										<IconFolder className="h-3 w-3 inline mr-1" />
										{item.folderName}
									</>
								)}
								{item.status === "success" && (
									<>
										<IconFolder className="h-3 w-3 inline mr-1" />
										{item.folderName}
									</>
								)}
								{item.status === "error" && (item.error || "Failed")}
								{item.status === "cancelled" && "Cancelled"}
							</p>
						</div>

						{/* File Size or Progress */}
						<div className="shrink-0 text-xs text-muted-foreground">
							{item.status === "uploading" ? `${item.progress}%` : `${(item.file.size / 1024 / 1024).toFixed(1)} MB`}
						</div>
					</div>
				))}
			</div>
			{/* Progress Footer */}
			<div className="p-3 border-t bg-muted/20">
				<div className="h-1.5 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full bg-primary rounded-full transition-all duration-300"
						style={{ width: `${overallProgress}%` }}
					/>
				</div>
				<div className="flex items-center justify-between mt-1">
					<p className="text-xs text-muted-foreground">
						{uploadingFiles.filter((f) => f.status === "success").length} of {uploadingFiles.length} complete
					</p>
					<p className="text-xs font-medium">Total: {Math.round(overallProgress)}%</p>
				</div>
			</div>
		</div>
	);
}
