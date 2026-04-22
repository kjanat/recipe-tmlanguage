/**
 * @file Pure verifier — tokenizes tree-sitter-recipe's own highlight fixtures
 * with the generated TextMate grammar and reports whether each caret assertion
 * lands on a matching scope.
 *
 * No CLI concerns here; the caller supplies paths and decides how to present
 * the result (text table / JSON / exit code).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as oniguruma from 'vscode-oniguruma';
import { INITIAL, parseRawGrammar, Registry } from 'vscode-textmate';

// ── capture → scope mapping (inverse of grammar.ts SCOPE) ───────────────────
// Fixtures speak tree-sitter capture names; the tokenizer speaks TextMate
// scopes. A token passes when one of its scopes starts with the expected
// prefix below — the scope tree is hierarchical, so prefix-match is correct.
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

export type Failure = {
	fixture: string;
	line: number;
	col: number;
	capture: string;
	got: string[] | null;
};

export type VerifyResult = {
	pass: number;
	total: number;
	failures: Failure[];
};

export type VerifyOptions = {
	grammarPath: string;
	fixturesDir: string;
	onigWasmPath: string;
};

// ── fixture parser ──────────────────────────────────────────────────────────
type Assertion = {
	fixture: string;
	targetLine: number; // 1-indexed source line
	col: number; // 0-indexed column
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

		const col = kind === '<-' ? 0 : raw.indexOf('^');
		asserts.push({ fixture: name, targetLine, col, capture });
	}

	return { source: sourceLines.join('\n'), asserts };
}

// ── main ────────────────────────────────────────────────────────────────────
export async function verify(opts: VerifyOptions): Promise<VerifyResult> {
	const wasmBin = readFileSync(opts.onigWasmPath);
	await oniguruma.loadWASM(wasmBin.buffer as ArrayBuffer);

	const onigLib = Promise.resolve({
		createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
		createOnigString: (s: string) => new oniguruma.OnigString(s),
	});

	const rawGrammar = parseRawGrammar(
		readFileSync(opts.grammarPath, 'utf-8'),
		opts.grammarPath,
	);
	const registry = new Registry({ onigLib, loadGrammar: async () => null });
	const grammar = await registry.addGrammar(rawGrammar);

	const result: VerifyResult = { pass: 0, total: 0, failures: [] };

	for (const name of readdirSync(opts.fixturesDir).sort()) {
		if (!name.endsWith('.recipe')) continue;
		const content = readFileSync(resolve(opts.fixturesDir, name), 'utf-8');
		const { source, asserts } = parseFixture(content, name);

		const sourceLines = source.split('\n');
		let ruleStack = INITIAL;
		const perLine: { start: number; end: number; scopes: string[] }[][] = [];
		for (const line of sourceLines) {
			const r = grammar.tokenizeLine(line, ruleStack);
			perLine.push(r.tokens.map((t) => ({
				start: t.startIndex,
				end: t.endIndex,
				scopes: [...t.scopes],
			})));
			ruleStack = r.ruleStack;
		}

		for (const a of asserts) {
			result.total += 1;
			const tokens = perLine[a.targetLine - 1];
			const hit = tokens?.find((t) => a.col >= t.start && a.col < t.end);
			const expected = CAPTURE_EXPECTS[a.capture];
			const passed = !!(hit && expected && hit.scopes.some((s) => s.startsWith(expected)));
			if (passed) {
				result.pass += 1;
			} else {
				result.failures.push({
					fixture: a.fixture,
					line: a.targetLine,
					col: a.col,
					capture: a.capture,
					got: hit ? hit.scopes : null,
				});
			}
		}
	}

	return result;
}
