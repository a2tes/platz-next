module.exports = {
	apps: [
		{
			name: "platz-client",
			cwd: "/var/www/platz-next/client",
			script: "pnpm",
			args: "start",
			interpreter: "none",
			env_production: {
				NODE_ENV: "production",
				PORT: 3000,
			},
		},
		{
			name: "platz-admin",
			cwd: "/var/www/platz-next/admin",
			script: "pnpm",
			args: "start",
			interpreter: "none",
			env_production: {
				NODE_ENV: "production",
				PORT: 3001,
			},
		},
		{
			name: "platz-api",
			cwd: "/var/www/platz-next/api",
			script: "pnpm",
			args: "start",
			interpreter: "none",
			env_production: {
				NODE_ENV: "production",
				PORT: 4000,
			},
		},
	],
};
