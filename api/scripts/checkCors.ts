import dotenv from "dotenv";
import { getAllowedOrigins, isOriginAllowed } from "../src/utils/cors";

dotenv.config();

const args = process.argv.slice(2);
const tests = args.length
	? args
	: [
			`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}`,
			`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}`,
			`${process.env.NEXT_PUBLIC_PROTOCOL}://admin.${process.env.NEXT_PUBLIC_HOSTNAME}`,
	  ];

console.log("Allowed origins (computed):", getAllowedOrigins());
console.log("");
for (const origin of tests) {
	console.log(
		`${origin} -> ${isOriginAllowed(origin) ? "ALLOWED" : "BLOCKED"}`
	);
}
