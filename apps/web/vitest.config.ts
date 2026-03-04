import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		exclude: ["e2e/**", "node_modules/**"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
