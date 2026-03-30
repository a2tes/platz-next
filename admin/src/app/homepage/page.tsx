"use client";

import * as React from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { SeoButton } from "@/components/settings/SeoButton";

export default function HomepagePage() {
	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="space-y-6">
						<div className="flex items-center justify-between mb-6">
							<div>
								<h1 className="text-3xl font-bold">Homepage</h1>
								<div className="text-sm text-muted-foreground mt-1">Manage homepage settings.</div>
							</div>
							<div className="flex items-center gap-2">
								<SeoButton pageKey="homepage" pageTitle="Homepage" />
							</div>
						</div>
					</div>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
