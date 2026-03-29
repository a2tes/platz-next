"use client";

import { useState } from "react";
import ActivityFeed from "./ActivityFeed";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";

interface ActivityTabsProps {
	className?: string;
}

export default function ActivityTabs({ className = "" }: ActivityTabsProps) {
	const [activeTab, setActiveTab] = useState<"all" | "my">("all");

	return (
		<Card className={`${className} gap-0 rounded-3xl`}>
			<CardHeader className="border-b !pb-4 items-center">
				<CardTitle>Activity Feed</CardTitle>
				<CardDescription>
					<div data-slot="card-action">
						<Tabs
							value={activeTab}
							onValueChange={(v) => setActiveTab(v as "all" | "my")}
						>
							<TabsList>
								<TabsTrigger value="all">All</TabsTrigger>
								<TabsTrigger value="my">Mine</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-6">
				<ActivityFeed type={activeTab} />
			</CardContent>
		</Card>
	);
}
