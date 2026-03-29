"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ImagesManager } from "@/components/photography/ImagesManager";
import { useQuery } from "@tanstack/react-query";
import { PhotographyService } from "@/services/photographyService";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function CategoryImagesPage() {
	const params = useParams();
	const id = Number(params.id);

	const { data, isLoading } = useQuery({
		queryKey: ["category", id],
		queryFn: () => PhotographyService.getCategory(id),
		enabled: !isNaN(id),
	});

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						{isLoading ? (
							<Skeleton className="h-8 w-64" />
						) : (
							<div className="flex items-center justify-between">
								<div>
									<h1 className="text-3xl font-bold tracking-tight">
										{data?.title}
									</h1>
									<p className="text-sm text-muted-foreground">
										Manage images for this category
									</p>
								</div>
								<Link
									href="/photography"
									className="text-sm text-muted-foreground hover:underline"
								>
									Back to Photography
								</Link>
							</div>
						)}
					</div>

					{!isNaN(id) && <ImagesManager parentType="category" parentId={id} />}
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
