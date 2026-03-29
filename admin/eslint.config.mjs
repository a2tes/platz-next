import next from "eslint-config-next";

// Use Next.js flat config directly to avoid legacy compat + rushstack patch issues.
export default [
	...next,
	{
		ignores: [
			"node_modules/**",
			".next/**",
			"out/**",
			"build/**",
			"next-env.d.ts",
		],
	},
];
