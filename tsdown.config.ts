import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { "recipe-tmlang": "./bin/recipe-tmlang.ts" },
	outDir: "bin",
	format: "esm",
	platform: "node",
	fixedExtension: true,
	clean: false,
	dts: false,
	minify: "dce-only",
});
