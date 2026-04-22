# recipe-tmlanguage

## OVERVIEW

This package generates `dist/recipe.tmLanguage.json` from `tree-sitter-recipe` vocab and verifies scopes against upstream highlight fixtures.

## WHERE TO LOOK

| Task                           | Location                      | Notes                                       |
| ------------------------------ | ----------------------------- | ------------------------------------------- |
| Generate TextMate grammar      | `src/grammar.ts`              | Ordering-sensitive regex logic              |
| Verify TextMate scopes         | `src/verifier.ts`             | Inverse bridge from captures to scopes      |
| CLI wiring and path resolution | `cli.ts`                      | Uses package exports, not fragile relatives |
| Published artifact             | `dist/recipe.tmLanguage.json` | Generated output                            |

## SOURCE OF TRUTH

- Vocab arrays live in `tree-sitter-recipe/grammar/**`.
- Semantic highlight intent lives in `tree-sitter-recipe/queries/highlights.scm`.
- Verification fixtures live in `tree-sitter-recipe/test/highlight/*.recipe`.
- This repo adapts those sources. It should not invent parallel vocab lists.

## CONVENTIONS

- Bun link must work before generate/verify:

```bash
cd ../tree-sitter-recipe && bun link
cd ../recipe-tmlanguage && bun link tree-sitter-recipe && bun install
```

- TextMate is first-match, so ordering is load-bearing.
- Keep multiword patterns before single-word patterns.
- Keep `doseMatch` before bare numbers.
- Keep doc comments before plain comments.
- Keep `wb()` semantics; plain `\b` is not enough for dotted abbreviations.

## COMMANDS

```bash
bun install
bun run typecheck
bun run generate
bun run verify
bun cli.ts verify --max-failures 0
```

## VERIFIER RULES

- `# ^^^ capture.name` checks first caret column on previous source line.
- `# <- capture.name` checks column `0` on previous source line.
- Verification uses prefix matching because TextMate scopes are hierarchical.
- `CAPTURE_EXPECTS` must stay aligned with upstream capture names.

## ANTI-PATTERNS

- Do not hand-edit `dist/recipe.tmLanguage.json`.
- Do not replace export-based path resolution with relative paths.
- Do not reorder regex clauses casually.
- Do not change upstream capture names without updating `CAPTURE_EXPECTS`.
- Do not forget regenerate + verify after upstream vocab/query changes.

## CHANGE CHECKLIST

- Parser vocab changed: regenerate and verify.
- Capture meaning changed: update verifier mapping and re-run verify.
- CLI path logic changed: keep `import.meta.resolve(...)` flow intact.
