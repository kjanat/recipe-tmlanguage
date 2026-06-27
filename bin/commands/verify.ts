import { packageDir, resolveImportMeta } from "#bin/lib/utils.ts";
import { verify } from "#src/verifier.ts";
import { command, flag } from "@kjanat/dreamcli";
import { resolve } from "node:path";
import { cwd, exit } from "node:process";

const DEFAULT_FIXTURES_DIR = resolve(packageDir("tree-sitter-recipe/package.json"), "test/highlight");
const DEFAULT_OUT = resolveImportMeta("#tmLang");

export const verifyCmd = command("verify")
	.description("Tokenize tree-sitter-recipe highlight fixtures and assert scope matches")
	.flag("grammar", flag.string().alias("g").default(DEFAULT_OUT).describe("Path to .tmLanguage.json"))
	.flag("fixtures", flag.string().alias("f").default(DEFAULT_FIXTURES_DIR).describe("Directory of .recipe fixtures"))
	.flag("max-failures", flag.number().default(40).describe("Max failures to print (0 = all)"))
	.action(async ({ flags, out }) => {
		const result = await verify({
			grammarPath: resolve(cwd(), flags.grammar),
			fixturesDir: resolve(cwd(), flags.fixtures),
		});
		const failuresLen = result.failures.length;
		const { json, jsonMode, setExitCode, log } = out;

		if (jsonMode) {
			json(result);
			if (failuresLen > 0) {
				setExitCode(1);
				exit();
			}
			return;
		}

		log(`${result.pass} / ${result.total} assertions pass`);
		if (failuresLen === 0) return;

		log("");
		log("── failures ──");
		const limit = flags["max-failures"] === 0 ? failuresLen : flags["max-failures"];
		for (const f of result.failures.slice(0, limit)) {
			const gotStr = f.got
				? f.got.filter((s) => s !== "source.recipe").join(" · ") || "(root only)"
				: "(no token)";
			log(`  ${f.fixture}:${f.line}:${f.col}  expected ${f.capture}  got [${gotStr}]`);
		}
		if (failuresLen > limit) {
			log(`  … +${failuresLen - limit} more`);
		}
		setExitCode(1);
	});
