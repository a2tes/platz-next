"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { WorkForm } from "@/components/works/WorkForm";
import { Button } from "@/components/ui/button";
import { IconChevronLeft } from "@tabler/icons-react";

export default function NewWorkPage() {
	const router = useRouter();

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
						<h1 className="text-3xl font-bold tracking-tight">
							Create New Work
						</h1>

						<Button variant="outline" onClick={() => router.push("/works")}>
							<IconChevronLeft className="w-4 h-4" />
							Back to works
						</Button>
					</div>
					<WorkForm
						onClose={() => router.push("/works")}
						onSuccess={() => router.push("/works")}
					/>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
