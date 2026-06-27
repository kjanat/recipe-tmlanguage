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
