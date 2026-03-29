"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SplashScreenProps {
	clientName: string | null;
	clientNote: string | null;
	onComplete: () => void;
}

export default function SplashScreen({ clientName, clientNote, onComplete }: SplashScreenProps) {
	const [visible, setVisible] = useState(true);

	const handleDismiss = () => {
		setVisible(false);
	};

	return (
		<AnimatePresence onExitComplete={onComplete}>
			{visible && (
				<motion.div
					initial={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
					className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black cursor-pointer"
					onClick={handleDismiss}
				>
					{/* Platz Logo */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
						className="mb-8"
					>
						<svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
							<text x="0" y="32" fill="white" fontSize="32" fontFamily="Work Sans" fontWeight="300" letterSpacing="8">
								Platz
							</text>
						</svg>
					</motion.div>

					{/* Prepared for */}
					{clientName && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.6 }}
							className="text-center"
						>
							<p className="text-white/50 text-sm uppercase tracking-[4px] mb-3">Prepared for</p>
							<p className="text-white text-2xl font-light tracking-wide">{clientName}</p>
						</motion.div>
					)}

					{/* Client note */}
					{clientNote && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.6, delay: 1.0 }}
							className="mt-6 max-w-md text-center"
						>
							<p className="text-white/60 text-md font-light leading-relaxed">{clientNote}</p>
						</motion.div>
					)}

					{/* Start prompt */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.4, delay: 1.4 }}
						className="absolute bottom-12 flex flex-col items-center gap-3"
					>
						<p className="text-white/40 text-sm uppercase tracking-[3px]">CLICK ANYWHERE TO START</p>
						<div className="w-8 h-[1px] bg-white/20 overflow-hidden">
							<motion.div
								className="h-full bg-white/60"
								initial={{ x: "-100%" }}
								animate={{ x: "100%" }}
								transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
							/>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
