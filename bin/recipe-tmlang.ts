#!/usr/bin/env node
/**
 * recipe-tmlang — TextMate grammar generator & verifier for recipe-tmlanguage.
 *
 * Subcommands
 * - generate:   Build dist/recipe.tmLanguage.json from the tree-sitter-recipe vocab.
 * - verify:     Tokenize tree-sitter-recipe's highlight fixtures and assert scopes.
 *
 * Zero manual argparse — argument parsing, help, and completions all come from
 * {@link https://github.com/kjanat/dreamcli | DreamCLI}. `--json` is a DreamCLI built-in;
 * we branch on {@linkcode Out.jsonMode}.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";

import { cli, command, flag } from "dreamcli";
import type { Out } from "dreamcli";

import { buildGrammar, serializeGrammar } from "#grammar";
import { verify } from "#verifier";

import { homepage, repository, version } from "#pkg" with { type: "json" };

const DEFAULT_OUT = `${resolve(import.meta.dirname, "..")}/recipe.tmLanguage.json`;

const TS_RX_DIR = resolve(dirname(fileURLToPath(import.meta.resolve("tree-sitter-recipe/package.json"))));
const DEFAULT_FIXTURES_DIR = resolve(TS_RX_DIR, "test/highlight");
const DEFAULT_ONIG_WASM = fileURLToPath(import.meta.resolve("vscode-oniguruma/release/onig.wasm"));

const indentOf = (raw: string): "tab" | number => (raw === "tab" ? "tab" : Number(raw));

const generate = command("generate")
	.description("Build the TextMate grammar from the tree-sitter-recipe vocabulary")
	.flag("out", flag.string().alias("o").default(DEFAULT_OUT).describe("Output JSON path"))
	.flag("indent", flag.enum(["tab", "2", "4"]).default("tab").describe("JSON indent"))
	.flag("quiet", flag.boolean().alias("q").default(false).describe("Suppress stats on success"))
	.action(({ flags, out }) => {
		const { grammar, stats } = buildGrammar();
		const serialized = serializeGrammar(grammar, indentOf(flags.indent));
		const outAbs = resolve(cwd(), flags.out);
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

const verifyCmd = command("verify")
	.description("Tokenize tree-sitter-recipe highlight fixtures and assert scope matches")
	.flag("grammar", flag.string().alias("g").default(DEFAULT_OUT).describe("Path to .tmLanguage.json"))
	.flag("fixtures", flag.string().alias("f").default(DEFAULT_FIXTURES_DIR).describe("Directory of .recipe fixtures"))
	.flag("onig-wasm", flag.string().default(DEFAULT_ONIG_WASM).describe("Path to oniguruma WASM"))
	.flag("max-failures", flag.number().default(40).describe("Max failures to print (0 = all)"))
	.action(async ({ flags, out }) => {
		const result = await verify({
			grammarPath: resolve(cwd(), flags.grammar),
			fixturesDir: resolve(cwd(), flags.fixtures),
			onigWasmPath: resolve(cwd(), flags["onig-wasm"]),
		});
		const failuresLen = result.failures.length;

		if (out.jsonMode) {
			out.json(result);
			if (failuresLen > 0) {
				out.setExitCode(1);
				exit();
			}
			return;
		}

		out.log(`${result.pass} / ${result.total} assertions pass`);
		if (failuresLen === 0) return;

		out.log("");
		out.log("── failures ──");
		const limit = flags["max-failures"] === 0 ? failuresLen : flags["max-failures"];
		for (const f of result.failures.slice(0, limit)) {
			const gotStr = f.got
				? f.got.filter((s) => s !== "source.recipe").join(" · ") || "(root only)"
				: "(no token)";
			out.log(`  ${f.fixture}:${f.line}:${f.col}  expected ${f.capture}  got [${gotStr}]`);
		}
		if (failuresLen > limit) {
			out.log(`  … +${failuresLen - limit} more`);
		}
		out.setExitCode(1);
	});

export const app = cli("recipe-tmlang").packageJson({ repository, homepage, version }).links()
	.description("TextMate grammar generator & verifier for the recipe DSL")
	.command(generate)
	.command(verifyCmd)
	.completions();

if (import.meta.main) app.run();
