import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const toPath = (resolved: string) =>
	resolved.startsWith("file:")
		? fileURLToPath(resolved)
		: resolved;

export function packageDir(specifier: string): string {
	return resolve(dirname(toPath(require.resolve(specifier))));
}

export function resolveImportMeta(specifier: string): string {
	return toPath(import.meta.resolve(specifier));
}

/**
 * Default path of the generated grammar: `recipe.tmLanguage.json` at the
 * package root. Anchored on `#pkg` (package.json / deno.json — always present)
 * rather than `#tmLang`, because the grammar is generated + gitignored and may
 * not exist yet on a fresh checkout, and `import.meta.resolve` throws on a
 * missing target. Existence is enforced later, where the file is actually read.
 */
export function defaultGrammarPath(): string {
	return resolve(dirname(resolveImportMeta("#pkg")), "recipe.tmLanguage.json");
}
