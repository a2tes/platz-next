"use client";

import * as React from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { PhotographerForm } from "@/components/photography/PhotographerForm";
import { useRouter } from "next/navigation";

export default function NewPhotographerPage() {
	const router = useRouter();
	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						<h1 className="text-3xl font-bold tracking-tight">
							Create Photographer
						</h1>
					</div>
					<PhotographerForm
						onSuccess={() => router.push("/photography/photographers")}
						onClose={() => router.push("/photography/photographers")}
					/>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
