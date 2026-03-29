'use client';
import * as React from 'react';
import { motion, stagger, useAnimate } from 'motion/react';
import { cn } from '@/lib/utils';

type TextGenerateEffectProps = Omit<React.ComponentProps<'div'>, 'children'> & {
	words: string;
	filter?: boolean;
	duration?: number;
	staggerDelay?: number;
	delay?: number;
	onComplete?: () => void;
	animationDuration?: number;
};

function TextGenerateEffect({
	ref,
	words,
	className,
	filter = true,
	duration = 0.3,
	staggerDelay = 0.05,
	delay = 0,
	onComplete,
	animationDuration,
	...props
}: TextGenerateEffectProps) {
	const localRef = React.useRef<HTMLDivElement>(null);
	React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

	const [scope, animate] = useAnimate();
	const wordsArray = React.useMemo(() => words.split(' '), [words]);

	React.useEffect(() => {
		if (scope.current) {
			const timer = setTimeout(() => {
				animate(
					'span',
					{
						opacity: 1,
						filter: filter ? 'blur(0px)' : 'none',
					},
					{
						duration: duration,
						delay: stagger(staggerDelay),
					}
				);

				// Call onComplete after animation finishes
				if (onComplete && animationDuration) {
					setTimeout(() => {
						onComplete();
					}, animationDuration * 1000);
				}
			}, delay * 1000);

			return () => clearTimeout(timer);
		}
	}, [animate, duration, filter, scope, staggerDelay, delay, onComplete, animationDuration]);

	return (
		<div ref={localRef} className={cn(className)} data-slot="text-generate-effect" {...props}>
			<motion.div ref={scope}>
				{wordsArray.map((word, idx) => (
					<motion.span
						key={`${word}-${idx}`}
						className="opacity-0 will-change-transform will-change-opacity will-change-filter"
						style={{
							filter: filter ? 'blur(10px)' : 'none',
						}}
					>
						{word}{' '}
					</motion.span>
				))}
			</motion.div>
		</div>
	);
}

export { TextGenerateEffect, type TextGenerateEffectProps };
