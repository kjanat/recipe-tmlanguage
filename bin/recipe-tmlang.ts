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
 */
import { homepage, name, repository, version } from "#pkg" with { type: "json" };
import { cli } from "dreamcli";
import { generateCmd } from "./commands/generate.ts";
import { verifyCmd } from "./commands/verify.ts";

const app = cli(name).packageJson({ repository, homepage, version }).links()
	.description("TextMate grammar generator & verifier for the recipe DSL")
	.command(generateCmd)
	.command(verifyCmd)
	.completions();

if (import.meta.main) app.run();
