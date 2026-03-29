"use client";

import * as React from "react";
import Link from "next/link";
import { IconUser, IconSettings, IconPower, IconUserCog } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserProfile() {
	const { user, logout } = useAuthStore();

	const handleLogout = () => {
		logout();
	};

	// Get initials for fallback
	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
					{user?.avatarUrl ? (
						<Avatar className="h-8 w-8">
							<AvatarImage src={user.avatarUrl} alt={user.name} />
							<AvatarFallback>{user?.name ? getInitials(user.name) : <IconUser className="h-4 w-4" />}</AvatarFallback>
						</Avatar>
					) : (
						<IconUser className="h-4 w-4" />
					)}
					<span className="sr-only">User profile</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{user?.name}</p>
						<p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/settings">
						<IconUserCog className="mr-2 h-4 w-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleLogout}>
					<IconPower className="mr-2 h-4 w-4" />
					Logout
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
