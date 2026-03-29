"use client";

import * as React from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { LegalForm } from "@/components/content/LegalForm";

export default function LegalEditPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id: idStr } = React.use(params);
	const id = Number(idStr);
	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						<h1 className="text-3xl font-bold tracking-tight">
							Edit Legal Page
						</h1>
					</div>
					<LegalForm id={id} />
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
