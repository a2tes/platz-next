"use client";

import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface PageTransitionProps {
	children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
	const pathname = usePathname();

	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={pathname}
				initial={{
					// clipPath: "circle(0% at 0 0)",
					filter: "blur(12px)",
				}}
				animate={{
					// clipPath: "circle(150% at 0 0)",
					filter: "blur(0px)",
				}}
				transition={{
					duration: 0.7,
					ease: [0.22, 1, 0.36, 1],
				}}
				className="page-transition-wrapper"
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
}
