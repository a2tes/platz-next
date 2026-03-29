"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { PresentationForm } from "@/components/presentations/PresentationForm";
import { Button } from "@/components/ui/button";
import { IconChevronLeft } from "@tabler/icons-react";

export default function NewPresentationPage() {
	const router = useRouter();

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
						<h1 className="text-3xl font-bold tracking-tight">Create New Presentation</h1>

						<Button variant="outline" onClick={() => router.push("/works/presentations")}>
							<IconChevronLeft className="w-4 h-4" />
							Back to presentations
						</Button>
					</div>
					<PresentationForm />
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
