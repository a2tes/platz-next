"use client";

import * as React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Director } from "@/services/worksService";

interface AddDirectorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	directors: Director[];
	selectedDirectorIds: number[];
	onSelect: (directorId: number) => void;
}

export function AddDirectorDialog({
	open,
	onOpenChange,
	directors,
	selectedDirectorIds,
	onSelect,
}: AddDirectorDialogProps) {
	const [selectedId, setSelectedId] = React.useState<number | null>(null);

	const availableDirectors = React.useMemo(() => {
		return directors.filter((d) => !selectedDirectorIds.includes(d.id));
	}, [directors, selectedDirectorIds]);

	const handleConfirm = () => {
		if (selectedId) {
			onSelect(selectedId);
			onOpenChange(false);
			setSelectedId(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add Director</DialogTitle>
				</DialogHeader>
				<div className="py-4">
					<Command className="rounded-lg border shadow-md">
						<CommandInput placeholder="Search directors..." />
						<CommandList>
							<CommandEmpty>No directors found.</CommandEmpty>
							<CommandGroup>
								{availableDirectors.map((director) => (
									<CommandItem
										key={director.id}
										value={director.title}
										onSelect={() => setSelectedId(director.id)}
										className="cursor-pointer"
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												selectedId === director.id ? "opacity-100" : "opacity-0"
											)}
										/>
										{director.title}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleConfirm} disabled={!selectedId}>
						Add Director
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
