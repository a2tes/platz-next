"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { MediaTabs } from "@/components/media/MediaTabs";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";

function MediaPageContent() {
	const router = useRouter();
	const { openModal } = useMediaLibraryStore();

	React.useEffect(() => {
		// Open the media library modal on mount
		openModal();
	}, [openModal]);

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between pb-6 border-b">
					<div>
						<h1 className="text-4xl font-bold tracking-tight text-foreground">
							Media Library
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Manage your files and folders
						</p>
					</div>
					<Button
						onClick={() => router.push("/media/trash")}
						variant="outline"
						className="gap-2"
					>
						<IconTrash className="h-4 w-4" />
						Trash
					</Button>
				</div>

				{/* Media Library Tabs */}
				<div className="flex-1 mt-6">
					<MediaTabs />
				</div>
			</div>
		</AdminLayout>
	);
}

export default function MediaPage() {
	return (
		<ProtectedRoute>
			<MediaPageContent />
		</ProtectedRoute>
	);
}
