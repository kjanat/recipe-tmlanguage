// src/deps/oniguruma.ts
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { IOnigLib } from "./textmate.ts";

const require = createRequire(import.meta.url);
const oniguruma: typeof import("vscode-oniguruma") = require("vscode-oniguruma");

let loadPromise: Promise<void> | undefined;

export function loadOniguruma(): Promise<void> {
	loadPromise ??= (async () => {
		const wasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");
		const wasm = await readFile(wasmPath);

		await oniguruma.loadWASM(wasm);
	})();

	return loadPromise;
}

export async function createOnigLib(): Promise<IOnigLib> {
	await loadOniguruma();

	return {
		createOnigScanner(patterns) {
			return oniguruma.createOnigScanner(patterns);
		},
		createOnigString(string) {
			return oniguruma.createOnigString(string);
		},
	};
}

export const { loadWASM, createOnigScanner, createOnigString, OnigScanner, OnigString } = oniguruma;
