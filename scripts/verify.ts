/**
 * @file Tokenize every tree-sitter-recipe highlight fixture with the
 * generated TextMate grammar and compare against the `^ capture` assertions
 * embedded in each fixture.
 *
 * The fixture format comes from `tree-sitter highlight` tests:
 *
 *     R/ amoxicilline 500mg
 *     # <- keyword.directive
 *     #  ^ variable
 *     #               ^ number
 *
 * `# <-` asserts the capture at column 0 of the previous non-comment line;
 * `# ^` asserts the capture at the column of the caret.
 *
 * The tree-sitter captures we need to map to TextMate scopes for the
 * comparison — the scope map below is the inverse of the one in generate.ts.
 */
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as oniguruma from 'vscode-oniguruma';
import { INITIAL, parseRawGrammar, Registry } from 'vscode-textmate';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const fixturesDir = resolve(repoRoot, '..', 'tree-sitter-recipe', 'test', 'highlight');
const grammarPath = resolve(repoRoot, 'dist', 'recipe.tmLanguage.json');

// ── oniguruma wasm bootstrap ────────────────────────────────────────────────
const onigWasmPath = resolve(
	repoRoot,
	'node_modules',
	'vscode-oniguruma',
	'release',
	'onig.wasm',
);
const wasmBin = readFileSync(onigWasmPath);
await oniguruma.loadWASM(wasmBin.buffer as ArrayBuffer);

const onigLib = Promise.resolve({
	createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
	createOnigString: (s: string) => new oniguruma.OnigString(s),
});

// ── load the grammar ────────────────────────────────────────────────────────
const rawGrammar = parseRawGrammar(
	readFileSync(grammarPath, 'utf-8'),
	grammarPath,
);
const registry = new Registry({
	onigLib,
	loadGrammar: async (_scopeName) => null,
});
const grammar = await registry.addGrammar(rawGrammar);

// ── capture → scope mapping (inverse of generate.ts) ────────────────────────
// The fixtures speak tree-sitter capture names. The tokenizer speaks TextMate
// scopes. An assertion passes when the token at the target column has a scope
// string that contains the expected TextMate equivalent.
const CAPTURE_EXPECTS: Record<string, string> = {
	'keyword.directive': 'keyword.control.directive',
	'keyword.repeat': 'keyword.other.frequency',
	'keyword.error': 'invalid.illegal.warning',
	'keyword.operator': 'keyword.operator',
	'keyword.conditional': 'keyword.control.conditional',
	'keyword': 'keyword.other.timing',
	'function.macro': 'support.function.route',
	'attribute': 'entity.other.attribute-name',
	'type': 'storage.type.form',
	'type.builtin': 'support.type.unit',
	'number': 'constant.numeric',
	'variable': 'variable.other.ingredient',
	'string': 'string.unquoted.signa',
	'comment': 'comment',
	'comment.documentation': 'comment',
	'punctuation.delimiter': 'punctuation.separator',
};

// ── fixture parser ──────────────────────────────────────────────────────────
type Assertion = {
	fixture: string;
	targetLine: number; // 1-indexed
	col: number; // 0-indexed column in source line
	capture: string;
};

const ASSERT_RE = /^\s*#\s*(<-|\^+)\s+([\w.]+)\s*$/;
const COMMENT_ONLY_RE = /^\s*#/;

function parseFixture(content: string, name: string): { source: string; asserts: Assertion[] } {
	const rawLines = content.split(/\r?\n/);
	const sourceLines: string[] = [];
	const asserts: Assertion[] = [];
	const sourceLineIndexForRawLine: number[] = [];

	for (const raw of rawLines) {
		if (!COMMENT_ONLY_RE.test(raw)) {
			sourceLines.push(raw);
			sourceLineIndexForRawLine.push(sourceLines.length);
		} else {
			sourceLineIndexForRawLine.push(sourceLines.length);
		}
	}

	for (let i = 0; i < rawLines.length; i++) {
		const raw = rawLines[i] ?? '';
		if (!COMMENT_ONLY_RE.test(raw)) continue;
		const match = raw.match(ASSERT_RE);
		if (!match) continue;
		const [, kind, capture] = match;
		if (!kind || !capture) continue;
		const targetLine = sourceLineIndexForRawLine[i] ?? 0;
		if (targetLine === 0) continue;

		let col: number;
		if (kind === '<-') {
			col = 0;
		} else {
			// `#  ^^ cap` → column of the first ^ inside the raw line.
			const caretIdx = raw.indexOf('^');
			col = caretIdx; // Asserts apply to the source line at this column.
		}
		asserts.push({ fixture: name, targetLine, col, capture });
	}

	return { source: sourceLines.join('\n'), asserts };
}

// ── tokenize and compare ────────────────────────────────────────────────────
type ScopeLookup = (line: number, col: number) => string[] | null;

function buildScopeLookup(source: string): ScopeLookup {
	const lines = source.split('\n');
	let ruleStack = INITIAL;
	const perLineTokens: { startIndex: number; endIndex: number; scopes: string[] }[][] = [];

	for (const line of lines) {
		const result = grammar.tokenizeLine(line, ruleStack);
		perLineTokens.push(
			result.tokens.map((t) => ({
				startIndex: t.startIndex,
				endIndex: t.endIndex,
				scopes: [...t.scopes],
			})),
		);
		ruleStack = result.ruleStack;
	}

	return (line1: number, col: number) => {
		const tokens = perLineTokens[line1 - 1];
		if (!tokens) return null;
		for (const t of tokens) {
			if (col >= t.startIndex && col < t.endIndex) return t.scopes;
		}
		return null;
	};
}

function scopesMatchCapture(scopes: string[], capture: string): boolean {
	const expected = CAPTURE_EXPECTS[capture];
	if (!expected) return false;
	return scopes.some((s) => s.startsWith(expected));
}

// ── drive the whole suite ───────────────────────────────────────────────────
let totalAssertions = 0;
let totalPass = 0;
const failures: {
	fixture: string;
	line: number;
	col: number;
	capture: string;
	got: string[] | null;
}[] = [];

for (const name of readdirSync(fixturesDir).sort()) {
	if (!name.endsWith('.recipe')) continue;
	const path = resolve(fixturesDir, name);
	const content = readFileSync(path, 'utf-8');
	const { source, asserts } = parseFixture(content, name);
	const lookup = buildScopeLookup(source);

	for (const a of asserts) {
		totalAssertions += 1;
		const scopes = lookup(a.targetLine, a.col);
		if (scopes && scopesMatchCapture(scopes, a.capture)) {
			totalPass += 1;
		} else {
			failures.push({
				fixture: a.fixture,
				line: a.targetLine,
				col: a.col,
				capture: a.capture,
				got: scopes,
			});
		}
	}
}

console.log(`${totalPass} / ${totalAssertions} assertions pass`);
if (failures.length > 0) {
	console.log('');
	console.log('── failures ──');
	for (const f of failures.slice(0, 40)) {
		const gotStr = f.got
			? f.got.filter((s) => s !== 'source.recipe').join(' · ') || '(root only)'
			: '(no token)';
		console.log(
			`  ${f.fixture}:${f.line}:${f.col}  expected ${f.capture}  got [${gotStr}]`,
		);
	}
	if (failures.length > 40) console.log(`  … +${failures.length - 40} more`);
	process.exit(1);
}
