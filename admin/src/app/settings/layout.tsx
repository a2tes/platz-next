"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import { AdminLayout } from "../../components/layout/admin-layout";
import { useAuthStore } from "../../stores/authStore";
import { cn } from "../../lib/utils";
import { IconSettings, IconAddressBook, IconBrandInstagram, IconUser, IconKey } from "@tabler/icons-react";

const siteNavItems = [
	{ href: "/settings/general", label: "General", icon: IconSettings },
	{ href: "/settings/contact", label: "Contact", icon: IconAddressBook },
	{ href: "/settings/social-media", label: "Social Media", icon: IconBrandInstagram },
];

const profileNavItems = [
	{ href: "/settings/profile", label: "Profile", icon: IconUser },
	{ href: "/settings/profile/change-password", label: "Change Password", icon: IconKey },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { user } = useAuthStore();
	const isAdmin = user?.role === "ADMIN";

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Settings</h1>
						<p className="text-sm text-muted-foreground mt-1">Manage your site configuration and profile.</p>
					</div>

					<div className="flex flex-col md:flex-row gap-6">
						{/* Sidebar Navigation */}
						<nav className="w-full md:w-48 shrink-0">
							<div className="space-y-6">
								{isAdmin && (
									<div>
										<h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Site
										</h3>
										<div className="space-y-0.5">
											{siteNavItems.map((item) => {
												const Icon = item.icon;
												const isActive = pathname === item.href;
												return (
													<Link
														key={item.href}
														href={item.href}
														className={cn(
															"flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
															isActive
																? "bg-accent text-accent-foreground"
																: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
														)}
													>
														<Icon className="h-4 w-4" />
														{item.label}
													</Link>
												);
											})}
										</div>
									</div>
								)}

								<div>
									<h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Account
									</h3>
									<div className="space-y-0.5">
										{profileNavItems.map((item) => {
											const Icon = item.icon;
											const isActive = pathname === item.href;
											return (
												<Link
													key={item.href}
													href={item.href}
													className={cn(
														"flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
														isActive
															? "bg-accent text-accent-foreground"
															: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
													)}
												>
													<Icon className="h-4 w-4" />
													{item.label}
												</Link>
											);
										})}
									</div>
								</div>
							</div>
						</nav>

						{/* Content Area */}
						<div className="flex-1">{children}</div>
					</div>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
