"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { PhotographerForm } from "@/components/photography/PhotographerForm";
import { PhotographyService } from "@/services/photographyService";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

export default function EditPhotographerPage() {
	const router = useRouter();
	const params = useParams();
	const photographerId = parseInt(params.id as string, 10);

	const {
		data: photographer,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["photographer", photographerId],
		queryFn: () => PhotographyService.getPhotographer(photographerId),
		enabled: !isNaN(photographerId),
	});

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						<h1 className="text-3xl font-bold tracking-tight">
							{isLoading ? "Loading..." : "Edit Photographer"}
						</h1>
					</div>

					{isLoading && (
						<div className="space-y-4">
							<Skeleton className="h-64 w-full" />
							<Skeleton className="h-96 w-full" />
						</div>
					)}

					{isError && (
						<div className="text-center py-12">
							<p className="text-red-600">Error loading photographer</p>
						</div>
					)}

					{photographer && (
						<PhotographerForm
							onSuccess={() => router.push("/photography/photographers")}
							onClose={() => router.push("/photography/photographers")}
							photographer={photographer}
						/>
					)}
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
