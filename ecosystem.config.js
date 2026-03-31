module.exports = {
	apps: [
		{
			name: "platz-client",
			cwd: "/var/www/platz-next/client",
			script: "node_modules/.bin/next",
			args: "start -p 3000",
			env: {
				NODE_ENV: "production",
				PORT: 3000,
			},
		},
		{
			name: "platz-admin",
			cwd: "/var/www/platz-next/admin",
			script: "node_modules/.bin/next",
			args: "start -p 3001",
			env: {
				NODE_ENV: "production",
				PORT: 3001,
			},
		},
		{
			name: "platz-api",
			cwd: "/var/www/platz-next/api",
			script: "node_modules/.bin/next",
			args: "start -p 4000",
			env: {
				NODE_ENV: "production",
				PORT: 4000,
			},
		},
	],
};
