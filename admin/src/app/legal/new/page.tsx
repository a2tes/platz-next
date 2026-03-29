"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { LegalForm } from "@/components/content/LegalForm";

export default function NewLegalPage() {
	const router = useRouter();

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						<h1 className="text-3xl font-bold tracking-tight">
							Create Legal Page
						</h1>
					</div>
					<LegalForm
						onSuccess={() => {
							router.push("/legal");
						}}
					/>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
