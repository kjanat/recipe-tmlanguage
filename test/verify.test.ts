import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { buildGrammar, serializeGrammar } from "#grammar";
import { verify } from "#verifier";

const require = createRequire(import.meta.url);
const fixturesDir = resolve(dirname(require.resolve("tree-sitter-recipe/package.json")), "test/highlight");
const onigWasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");

test("every tree-sitter-recipe highlight fixture tokenizes to its expected scope", async () => {
	const grammarPath = resolve(tmpdir(), "recipe.tmLanguage.verify-test.json");
	writeFileSync(grammarPath, serializeGrammar(buildGrammar().grammar, "tab"));

	const result = await verify({ grammarPath, fixturesDir, onigWasmPath });

	expect(result.total).toBeGreaterThan(0);
	expect(result.failures).toEqual([]);
	expect(result.pass).toBe(result.total);
});
