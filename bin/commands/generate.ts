import { buildGrammar, serializeGrammar } from "#grammar";
import { command, flag } from "dreamcli";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { cwd } from "node:process";
const indentOf = (raw: string): "tab" | number => (raw === "tab" ? "tab" : Number(raw));
const require = createRequire(import.meta.url);
const DEFAULT_OUT = `${dirname(require.resolve("#pkg"))}/recipe.tmLanguage.json`;

export const generateCmd = command("generate")
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
