"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { ContentService, type ContentPage } from "@/services/contentService";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: ContentPage | null;
	onSaved: () => void;
}

export function LegalEditorModal({ open, onOpenChange, item, onSaved }: Props) {
	const router = useRouter();
	const [title, setTitle] = React.useState("");

	// If modal opened for editing an existing item, redirect to route editor
	React.useEffect(() => {
		if (open && item) {
			// Redirect to the dedicated edit page
			router.push(`/legal/${item.id}`);
			// Close the modal right away
			onOpenChange(false);
		}
	}, [open, item, router, onOpenChange]);

	const createMutation = useMutation({
		mutationFn: async () => {
			const created = await ContentService.createLegal({
				title: title.trim(),
				status: "DRAFT",
			});
			return created;
		},
		onSuccess: (created) => {
			onSaved();
			onOpenChange(false);
			router.push(`/legal/${created.id}`);
		},
	});

	const disabled = createMutation.isPending || !title.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>New Legal Page</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<label className="text-sm font-medium">Title</label>
					<Input
						placeholder="Enter title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !disabled) {
								createMutation.mutate();
							}
						}}
					/>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={createMutation.isPending}
					>
						Cancel
					</Button>
					<Button onClick={() => createMutation.mutate()} disabled={disabled}>
						{createMutation.isPending ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
