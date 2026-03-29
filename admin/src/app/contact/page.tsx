"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentPageForm } from "@/components/content/ContentPageForm";
import { ContentService } from "@/services/contentService";

export default function ContactPage() {
	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						<h1 className="text-3xl font-bold tracking-tight">Contact</h1>
						<div className="text-sm text-muted-foreground mt-1">
							Manage your contact information and communication details.
						</div>
					</div>
					<ContentPageForm
						queryKey="contact"
						getPage={ContentService.getContact}
						updatePage={ContentService.updateContact}
						editorKeyPrefix="contact"
						showMapEmbed
					/>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
