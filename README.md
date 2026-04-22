# recipe-tmlanguage

TextMate grammar for the [recipe] pharmacological notation language,
**generated** from the same JavaScript vocabulary modules that drive
`tree-sitter-recipe`'s parser.

Ships as `dist/recipe.tmLanguage.json` for consumption by Shiki, VS Code,
Sublime Text, Atom, `vscode-textmate`, and anything else that speaks
TextMate.

## Why generate, not author

The parser's vocabulary (`FREQUENCY`, `TIMING`, `ROUTE`, …, `UNITS`) lives in
plain `readonly string[]` modules under
`tree-sitter-recipe/grammar/`. Authoring a parallel TextMate grammar by hand
would mean copying those lists into regex alternations and re-copying them
every time the parser is touched. Drift guaranteed.

Instead, `src/grammar.ts` imports those exact modules through
`tree-sitter-recipe`'s package `exports` map, escapes metachars, sorts
alternatives longest-first (TextMate is first-match, not longest-match like
tree-sitter), and emits a ready-to-ship JSON grammar. One source of truth,
no sync burden.

## Scope map

Captures from `tree-sitter-recipe/queries/highlights.scm` are mapped to
**standard** TextMate scopes (`keyword.control.…`, `support.function.…`,
`invalid.illegal.…`, …) with a trailing `.recipe` namespace. Every mainstream
theme already paints these — no custom theme needs to be shipped with the
grammar.

| highlights.scm capture   | TextMate scope                                         |
| ------------------------ | ------------------------------------------------------ |
| `@keyword.directive`     | `keyword.control.directive.{rx,dispense,signa}.recipe` |
| `@keyword.repeat`        | `keyword.other.frequency.recipe`                       |
| `@keyword` (timing)      | `keyword.other.timing.recipe`                          |
| `@function.macro`        | `support.function.route.recipe`                        |
| `@attribute`             | `entity.other.attribute-name.recipe`                   |
| `@keyword.error`         | `invalid.illegal.warning.recipe`                       |
| `@type` (form)           | `storage.type.form.recipe`                             |
| `@keyword.operator`      | `keyword.operator.{compounding,fill,dtd}.recipe`       |
| `@keyword.conditional`   | `keyword.control.conditional.recipe`                   |
| `@number`                | `constant.numeric.recipe`                              |
| `@type.builtin` (unit)   | `support.type.unit.recipe`                             |
| `@variable` (ingredient) | `variable.other.ingredient.recipe`                     |
| `@string` (signa)        | `string.unquoted.signa.recipe`                         |
| `@comment`               | `comment.{line.number-sign,block}.recipe`              |
| `@comment.documentation` | `comment.{line,block}.documentation.recipe`            |
| `@punctuation.delimiter` | `punctuation.separator.recipe`                         |

## Layout

```text
recipe-tmlanguage/
├── cli.ts              # DreamCLI entry — `recipe-tmlang generate|verify`
├── src/
│   ├── grammar.ts      # pure: vocab → TextMate grammar object
│   └── verifier.ts     # pure: tokenize fixtures, check scope assertions
└── dist/
    └── recipe.tmLanguage.json
```

## Setup

`tree-sitter-recipe` is pulled in via Bun's link mechanism. Run once in the
sibling repo, then link here:

```sh
cd ../tree-sitter-recipe && bun link
cd ../recipe-tmlanguage && bun link tree-sitter-recipe && bun install
```

## CLI

Powered by [DreamCLI][dreamcli] — no hand-rolled argparse.

```sh
bun cli.ts --help
```

### `generate`

```sh
bun cli.ts generate                       # → dist/recipe.tmLanguage.json
bun cli.ts generate --out foo.json        # custom path
bun cli.ts generate --indent 2 --quiet    # 2-space indent, silent
bun cli.ts generate --json                # machine-readable result on stdout
```

### `verify`

Tokenizes every fixture in `tree-sitter-recipe/test/highlight/` with
`vscode-textmate` + `vscode-oniguruma` (the same engine Shiki wraps) and
asserts the scope at each caret marker matches the tree-sitter capture.
Fixtures and the Oniguruma WASM are located via package `exports` — no
relative paths to maintain.

```sh
bun cli.ts verify
bun cli.ts verify --json                  # { pass, total, failures[] }
bun cli.ts verify --max-failures 0        # print every failure
```

Current status: **148 / 149** fixture assertions pass. The single failing
assertion (`expanded.recipe:22:23`) points one column past the end of a
23-character source line — a fixture off-by-one, not a grammar defect.

### Drop into Shiki

```ts
import grammar from 'recipe-tmlanguage/dist/recipe.tmLanguage.json';
import { createHighlighter } from 'shiki';

const shiki = await createHighlighter({
	themes: ['github-dark'],
	langs: [grammar],
});

const html = shiki.codeToHtml(source, {
	lang: 'recipe',
	theme: 'github-dark',
});
```

The scope names are standard TextMate, so any Shiki theme paints recipe
blocks immediately.

## License

[MIT][License] © Kaj Kowalski

[recipe]: https://github.com/kjanat/tree-sitter-recipe
[dreamcli]: https://npm.im/@kjanat/dreamcli
[License]: LICENSE

<!-- markdownlint-disable-file no-hard-tabs -->
