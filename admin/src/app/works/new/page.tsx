"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { WorkForm } from "@/components/works/WorkForm";
import { Button } from "@/components/ui/button";
import { IconChevronLeft, IconLayoutDashboard } from "@tabler/icons-react";
import { PageDesignerModal } from "@/components/page-designer";

export default function NewWorkPage() {
	const router = useRouter();
	const [designerOpen, setDesignerOpen] = React.useState(false);

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
						<h1 className="text-3xl font-bold tracking-tight">Create New Work</h1>

						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => setDesignerOpen(true)}>
								<IconLayoutDashboard className="w-4 h-4" />
								Page Designer
							</Button>
							<Button variant="outline" onClick={() => router.push("/works")}>
								<IconChevronLeft className="w-4 h-4" />
								Back to works
							</Button>
						</div>
					</div>
					<WorkForm onClose={() => router.push("/works")} onSuccess={() => router.push("/works")} />
				</div>

				<PageDesignerModal
					open={designerOpen}
					onOpenChange={setDesignerOpen}
					modelName="Work"
					modelId={null}
					title="New Work"
				/>
			</AdminLayout>
		</ProtectedRoute>
	);
}
