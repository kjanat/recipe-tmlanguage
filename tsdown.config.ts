import { defineConfig } from "tsdown";

// Compile the DreamCLI entry to a node-runnable ESM file *next to* the source
// (`bin/recipe-tmlang.mjs`): node refuses to strip TypeScript types under
// node_modules, so the published bin can't be the raw `.ts`. Deps stay external
// and resolve from node_modules at runtime; `#pkg` (package.json) stays external
// too so the whole manifest isn't inlined just to read name/version.
export default defineConfig({
	entry: { "recipe-tmlang": "./bin/recipe-tmlang.ts" },
	outDir: "bin",
	format: "esm",
	platform: "node",
	fixedExtension: true,
	clean: false,
	dts: false,
});
