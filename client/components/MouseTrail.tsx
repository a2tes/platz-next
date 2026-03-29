'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';

export default function MouseTrail() {
	useEffect(() => {
		// Sadece desktop'ta çalıştır
		if (window.innerWidth < 768) return;

		const svgns = "http://www.w3.org/2000/svg";
		const mousetrail = document.getElementById("mousetrail");
		if (!mousetrail) return;

		const ease = 0.75;
		const pointer = {
			x: window.innerWidth / 2,
			y: window.innerHeight / 2
		};

		const handleMouseMove = (event: MouseEvent) => {
			pointer.x = event.clientX;
			pointer.y = event.clientY;
		};

		window.addEventListener("mousemove", handleMouseMove);

		let leader = pointer;
		const total = 100;

		function createLine(leader: typeof pointer, i: number) {
			const line = document.createElementNS(svgns, "line");
			mousetrail.appendChild(line);

			gsap.set(line, { x: -15, y: -15, opacity: (total - i) / total });

			const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

			gsap.to(line, {
				duration: 1000,
				x: "+=1",
				y: "+=1",
				repeat: -1,
				modifiers: {
					x: function () {
						const x = pos.x + (leader.x - pos.x) * ease;
						line.setAttribute("x2", String(leader.x - x));
						pos.x = x;
						return x;
					},
					y: function () {
						const y = pos.y + (leader.y - pos.y) * ease;
						line.setAttribute("y2", String(leader.y - y));
						pos.y = y;
						return y;
					}
				}
			});

			return pos;
		}

		for (let i = 0; i < total; i++) {
			leader = createLine(leader, i);
		}

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, []);

	return <svg id="mousetrail"></svg>;
}
