#!/usr/bin/env bun
/**
 * recipe-tmlang — TextMate grammar generator & verifier for recipe-tmlanguage.
 *
 * Subcommands:
 *   generate   Build dist/recipe.tmLanguage.json from the tree-sitter-recipe vocab.
 *   verify     Tokenize tree-sitter-recipe's highlight fixtures and assert scopes.
 *
 * Zero manual argparse — argument parsing, help, and completions all come
 * from DreamCLI. `--json` is a DreamCLI built-in; we branch on `out.jsonMode`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cli, command, flag } from "@kjanat/dreamcli";

import { buildGrammar, serializeGrammar } from "./src/grammar";
import { verify } from "./src/verifier";

const DEFAULT_OUT = "./dist/recipe.tmLanguage.json";

// Resolve the fixtures directory via the package's exports map. Anchoring on
// package.json (which every published package exposes) avoids depending on
// a specific fixture filename that could be renamed.
const DEFAULT_FIXTURES_DIR = pathResolve(
	dirname(fileURLToPath(import.meta.resolve("tree-sitter-recipe/package.json"))),
	"test/highlight",
);
const DEFAULT_ONIG_WASM = fileURLToPath(
	import.meta.resolve("vscode-oniguruma/release/onig.wasm"),
);

const indentOf = (raw: string): "tab" | number => (raw === "tab" ? "tab" : Number(raw));

// ── generate ────────────────────────────────────────────────────────────────
const generate = command("generate")
	.description("Build the TextMate grammar from the tree-sitter-recipe vocabulary")
	.flag(
		"out",
		flag.string().alias("o").default(DEFAULT_OUT).describe("Output JSON path"),
	)
	.flag(
		"indent",
		flag.enum(["tab", "2", "4"]).default("tab").describe("JSON indent (tab | 2 | 4)"),
	)
	.flag(
		"quiet",
		flag.boolean().alias("q").default(false).describe("Suppress stats on success"),
	)
	.action(({ flags, out }) => {
		const { grammar, stats } = buildGrammar();
		const serialized = serializeGrammar(grammar, indentOf(flags.indent));
		const outAbs = pathResolve(process.cwd(), flags.out);
		mkdirSync(dirname(outAbs), { recursive: true });
		writeFileSync(outAbs, serialized);

		if (out.jsonMode) {
			out.json({ ok: true, outPath: outAbs, bytes: serialized.length, stats });
			return;
		}
		if (flags.quiet) return;

		out.log(`wrote ${outAbs}`);
		out.log(`  ${stats.topLevelPatterns} top-level patterns · ${serialized.length} bytes`);
		const v = stats.vocab;
		out.log(
			`  vocab: ${v.frequency} frequency · ${v.timing.single}+${v.timing.multi} timing · ${v.route.single}+${v.route.multi} route · ${v.dispensing.single}+${v.dispensing.multi} dispensing · ${v.forms.single}+${v.forms.multi} forms · ${v.compounding.single}+${v.compounding.multi} compounding · ${v.conditional.single}+${v.conditional.multi} conditional · ${v.warning} warning · ${v.units} units`,
		);
	});

// ── verify ──────────────────────────────────────────────────────────────────
const verifyCmd = command("verify")
	.description("Tokenize tree-sitter-recipe highlight fixtures and assert scope matches")
	.flag(
		"grammar",
		flag.string().alias("g").default(DEFAULT_OUT).describe("Path to .tmLanguage.json"),
	)
	.flag(
		"fixtures",
		flag.string().alias("f").default(DEFAULT_FIXTURES_DIR).describe(
			"Directory of .recipe fixtures (defaults to tree-sitter-recipe/test/highlight)",
		),
	)
	.flag(
		"onig-wasm",
		flag.string().default(DEFAULT_ONIG_WASM).describe("Path to oniguruma WASM"),
	)
	.flag(
		"max-failures",
		flag.number().default(40).describe("Max failures to print (0 = all)"),
	)
	.action(async ({ flags, out }) => {
		const result = await verify({
			grammarPath: pathResolve(process.cwd(), flags.grammar),
			fixturesDir: pathResolve(process.cwd(), flags.fixtures),
			onigWasmPath: pathResolve(process.cwd(), flags["onig-wasm"]),
		});

		if (out.jsonMode) {
			out.json(result);
			if (result.failures.length > 0) process.exit(1);
			return;
		}

		out.log(`${result.pass} / ${result.total} assertions pass`);
		if (result.failures.length === 0) return;

		out.log("");
		out.log("── failures ──");
		const limit = flags["max-failures"] === 0 ? result.failures.length : flags["max-failures"];
		for (const f of result.failures.slice(0, limit)) {
			const gotStr = f.got
				? f.got.filter((s) => s !== "source.recipe").join(" · ") || "(root only)"
				: "(no token)";
			out.log(`  ${f.fixture}:${f.line}:${f.col}  expected ${f.capture}  got [${gotStr}]`);
		}
		if (result.failures.length > limit) {
			out.log(`  … +${result.failures.length - limit} more`);
		}
		process.exit(1);
	});

// ── app ─────────────────────────────────────────────────────────────────────
export const app = cli("recipe-tmlang")
	.version("0.1.0")
	.description("TextMate grammar generator & verifier for the recipe DSL")
	.command(generate)
	.command(verifyCmd)
	.completions();

if (import.meta.main) {
	app.run();
}
