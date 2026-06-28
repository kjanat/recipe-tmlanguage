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
 * we branch on {@linkcode out.jsonMode | https://dreamcli.kjanat.com/reference/symbols/main/Out#jsonmode}.
 *
 * @module recipe-tmlanguage/bin
 */
import { cli } from "@kjanat/dreamcli";
import { generateCmd } from "./commands/generate.ts";
import { verifyCmd } from "./commands/verify.ts";

const app = cli("recipe-tmlanguage")
	.manifest({ from: import.meta.url, files: ["package.json", "deno.json"] })
	.links()
	.description("TextMate grammar generator & verifier for the recipe DSL")
	.command(generateCmd)
	.command(verifyCmd)
	.completions();

if (import.meta.main) app.run();
