"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentPageForm } from "@/components/content/ContentPageForm";
import { ContentService } from "@/services/contentService";

export default function AboutPage() {
	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						<h1 className="text-3xl font-bold tracking-tight">About</h1>
						<div className="text-sm text-muted-foreground mt-1">
							Create and update the content that defines your brand story.
						</div>
					</div>
					<ContentPageForm
						queryKey="about"
						getPage={ContentService.getAbout}
						updatePage={ContentService.updateAbout}
						editorKeyPrefix="about"
					/>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
