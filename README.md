# recipe-tmlanguage

[![NPM](https://img.shields.io/npm/v/recipe-tmlanguage?logo=npm&labelColor=CB3837&color=black)][npm]
[![JSR](https://img.shields.io/jsr/v/@kjanat/recipe-tmlanguage?logoColor=083344&logo=jsr&logoSize=auto&label=&labelColor=f7df1e&color=black)][jsr]

TextMate grammar for the [recipe] pharmacological notation language,
**generated** from the same JavaScript vocabulary modules that drive
`tree-sitter-recipe`'s parser.

Ships as `recipe.tmLanguage.json` (the package's main export) — load it in
Shiki, a VS Code language extension, Monaco (via `monaco-textmate`), or any
other `vscode-textmate` host.

## Why generate, not author

The parser's vocabulary (`FREQUENCY`, `TIMING`, `ROUTE`, …, `UNITS`, plus the
Dutch patient-prose frequency vocab in `grammar/dutch`) lives in plain
`readonly string[]` modules under
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
├── bin/
│   └── recipe-tmlang.ts    # DreamCLI entry — `recipe-tmlang generate|verify`
├── src/
│   ├── grammar.ts          # pure: vocab → TextMate grammar object
│   └── verifier.ts         # pure: tokenize fixtures, check scope assertions
├── recipe.tmLanguage.json  # generated grammar (the main export)
└── recipe.tmLanguage.ts    # typed re-export of the JSON
```

## Install

```sh
bun add recipe-tmlanguage        # or: npm install recipe-tmlanguage
```

The grammar is pre-generated in the package — no build step for consumers.

## Develop

`tree-sitter-recipe` is a regular npm dependency now, so a plain install is
all the setup there is:

```sh
bun install
bun run generate     # rebuild recipe.tmLanguage.json
bun run verify       # check scopes against the upstream fixtures
```

## CLI

Powered by [DreamCLI][dreamcli] — no hand-rolled argparse.

```sh
npx recipe-tmlanguage --help   # or: bunx recipe-tmlanguage --help
```

### `generate`

```sh
npx recipe-tmlanguage generate                    # → recipe.tmLanguage.json
npx recipe-tmlanguage generate --out foo.json     # custom path
npx recipe-tmlanguage generate --indent 2 --quiet # 2-space indent, silent
npx recipe-tmlanguage generate --json             # machine-readable on stdout
```

### `verify`

Tokenizes every fixture in `tree-sitter-recipe/test/highlight/` with
`vscode-textmate` + `vscode-oniguruma` (the same engine Shiki wraps) and
asserts the scope at each caret marker matches the tree-sitter capture.
Fixtures and the Oniguruma WASM are located via package `exports` — no
relative paths to maintain.

```sh
npx recipe-tmlanguage verify
npx recipe-tmlanguage verify --json           # { pass, total, failures[] }
npx recipe-tmlanguage verify --max-failures 0 # print every failure
```

Current status: **149 / 149** fixture assertions pass.

### Use with Shiki

Don't register the raw JSON yourself — its grammar name is `Recipe`, which
won't match a `lang: "recipe"` lookup. Reach for [`recipe-shiki`][recipe-shiki]
instead: it wraps this grammar in a `LanguageRegistration` with the canonical
lang `recipe` (and alias `rx`).

For any other `vscode-textmate` host, load `recipe.tmLanguage.json` directly —
grammar name `Recipe`, scope `source.recipe`. The scopes are standard TextMate,
so any theme paints recipe blocks immediately.

## License

[MIT][License] © Kaj Kowalski

[License]: LICENSE
[dreamcli]: https://npm.im/@kjanat/dreamcli
[jsr]: https://jsr.io/@kjanat/recipe-tmlanguage
[npm]: https://npm.im/recipe-tmlanguage
[recipe]: https://github.com/kjanat/tree-sitter-recipe
[recipe-shiki]: https://github.com/kjanat/recipe-shiki

<!-- markdownlint-disable-file no-hard-tabs -->
