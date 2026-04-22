/**
 * @file Generate recipe.tmLanguage.json from the tree-sitter-recipe vocabulary.
 *
 * Single source of truth: the same JS vocab modules that drive grammar.js
 * (FREQUENCY, TIMING, ROUTE, …, UNITS) are imported verbatim and compiled
 * into a TextMate grammar. Any change to a list in tree-sitter-recipe/grammar
 * re-emits a fresh .tmLanguage.json on `bun run generate`.
 *
 * Scopes are mapped to the *standard* TextMate vocabulary (keyword.control,
 * support.function, invalid.illegal, …) so any Shiki / VSCode theme paints
 * recipe blocks without ever shipping a theme with the grammar.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMPOUNDING, COMPOUNDING_MULTIWORD } from '../../tree-sitter-recipe/grammar/latin/compounding.js';
import { CONDITIONAL, CONDITIONAL_MULTIWORD } from '../../tree-sitter-recipe/grammar/latin/conditional.js';
import { DISPENSING, DISPENSING_MULTIWORD } from '../../tree-sitter-recipe/grammar/latin/dispensing.js';
import { FORMS, FORMS_MULTIWORD } from '../../tree-sitter-recipe/grammar/latin/forms.js';
import { FREQUENCY } from '../../tree-sitter-recipe/grammar/latin/frequency.js';
import { ROUTE, ROUTE_MULTIWORD } from '../../tree-sitter-recipe/grammar/latin/route.js';
import { TIMING, TIMING_MULTIWORD } from '../../tree-sitter-recipe/grammar/latin/timing.js';
import { WARNING } from '../../tree-sitter-recipe/grammar/latin/warning.js';
import { UNITS } from '../../tree-sitter-recipe/grammar/units/index.js';

// ── scope map ───────────────────────────────────────────────────────────────
// Keyed by the capture names used in tree-sitter-recipe's highlights.scm,
// values are standard TextMate scope names with a `.recipe` suffix so theme
// authors can target us specifically without breaking the generic cascade.
const SCOPE = {
	rxMarker: 'keyword.control.directive.rx.recipe',
	dispenseMarker: 'keyword.control.directive.dispense.recipe',
	signaMarker: 'keyword.control.directive.signa.recipe',

	frequency: 'keyword.other.frequency.recipe',
	timing: 'keyword.other.timing.recipe',
	route: 'support.function.route.recipe',
	dispensing: 'entity.other.attribute-name.recipe',
	warning: 'invalid.illegal.warning.recipe',
	form: 'storage.type.form.recipe',
	compounding: 'keyword.operator.compounding.recipe',
	conditional: 'keyword.control.conditional.recipe',

	fillMarker: 'keyword.operator.fill.recipe',
	dtdKeyword: 'keyword.operator.dtd.recipe',

	number: 'constant.numeric.recipe',
	unit: 'support.type.unit.recipe',

	lineComment: 'comment.line.number-sign.recipe',
	docCommentLine: 'comment.line.documentation.recipe',
	blockComment: 'comment.block.recipe',
	docCommentBlock: 'comment.block.documentation.recipe',

	punctuation: 'punctuation.separator.recipe',

	ingredientWord: 'variable.other.ingredient.recipe',
	signaWord: 'string.unquoted.signa.recipe',
	dispenseWord: 'variable.other.dispense.recipe',
} as const;

// ── regex helpers ───────────────────────────────────────────────────────────
// TextMate uses Oniguruma, which is PCRE-ish but first-match (not longest-
// match). So we always sort alternatives longest-first before joining.
const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;

const escapeRegex = (s: string): string => s.replace(REGEX_METACHARS, '\\$&');

const alt = (items: readonly string[]): string =>
	[...new Set(items)]
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex)
		.join('|');

// Multiword tokens: escape dots, collapse any whitespace run into `\s+` so
// irregular spacing still matches (mirrors tree-sitter-recipe's own helper).
const altMultiword = (items: readonly string[]): string =>
	[...new Set(items)]
		.sort((a, b) => b.length - a.length)
		.map((s) => s.replace(/\./g, '\\.').replace(/\s+/g, '\\s+'))
		.join('|');

// Word boundary that treats `.` as part of the token, so `a.c.` doesn't match
// inside `a.c.e.`. `\b` alone is not enough because `.` is a non-word char.
const wb = (pattern: string): string => `(?<![\\w.])(?:${pattern})(?![\\w.])`;

// ── tmLanguage types (structural — no dependency on vscode-textmate) ────────
type Capture = { name?: string; patterns?: Pattern[] };
type Captures = Record<string, Capture>;
type Pattern =
	| { include: string }
	| { name?: string; match: string; captures?: Captures }
	| {
		name?: string;
		begin: string;
		end: string;
		beginCaptures?: Captures;
		endCaptures?: Captures;
		patterns?: Pattern[];
		contentName?: string;
	};

type Grammar = {
	$schema?: string;
	name: string;
	scopeName: string;
	fileTypes: string[];
	patterns: Pattern[];
	repository: Record<string, { patterns: Pattern[] } | Pattern>;
};

// ── repository pieces ───────────────────────────────────────────────────────
// Dose must come before bare number, else "50" matches first and leaves "mg"
// to fall to the word fallback.
const doseMatch: Pattern = {
	match: `(\\d+(?:[.,]\\d+)?)\\s*(${alt(UNITS)})(?![A-Za-zÀ-ÿ])`,
	captures: {
		'1': { name: SCOPE.number },
		'2': { name: SCOPE.unit },
	},
};

const bareNumber: Pattern = {
	match: '\\d+(?:[.,]\\d+)?',
	name: SCOPE.number,
};

// Compact modern frequency: "1 dd", "1dd". Standalone rule in the grammar;
// beats the word fallback because it's in the pattern list before it.
const compactFrequency: Pattern = {
	match: '[1-9]\\s*dd(?![A-Za-zÀ-ÿ0-9])',
	name: SCOPE.frequency,
};

// "ad 100 g" — fill-to. The word `ad` is also a valid Dutch/Latin preposition
// on its own, so we only paint it when followed by whitespace + digit.
const fillTo: Pattern = {
	match: '\\bad\\b(?=\\s+\\d)',
	name: SCOPE.fillMarker,
};

// "dtd no 90", "d.t.d. no 14", "dtd 14". The trailing number is left to the
// dose/number rules that follow.
const dtdDirective: Pattern = {
	match: '(?i)(?<![\\w.])(d\\.?t\\.?d\\.?)(?:\\s+(no))?(?=\\s+\\d)',
	captures: {
		'1': { name: SCOPE.dtdKeyword },
		'2': { name: SCOPE.dtdKeyword },
	},
};

// WARNING is case-sensitive (CITO / cito / Cito are separate entries in the
// vocab list). Painted loud: invalid.illegal gets red/bold in most themes.
const warningAbbrev: Pattern = {
	match: wb(alt(WARNING)),
	name: SCOPE.warning,
};

// Latin abbreviation categories — multiword first (longer match wins), then
// dotted singles. All gated by `wb()` so dotted forms don't bleed.
const latinAbbrevs: Pattern[] = [
	{ match: wb(altMultiword(TIMING_MULTIWORD)), name: SCOPE.timing },
	{ match: wb(altMultiword(ROUTE_MULTIWORD)), name: SCOPE.route },
	{ match: wb(altMultiword(DISPENSING_MULTIWORD)), name: SCOPE.dispensing },
	{ match: wb(altMultiword(FORMS_MULTIWORD)), name: SCOPE.form },
	{ match: wb(altMultiword(COMPOUNDING_MULTIWORD)), name: SCOPE.compounding },
	{ match: wb(altMultiword(CONDITIONAL_MULTIWORD)), name: SCOPE.conditional },
	{ match: wb(alt(FREQUENCY)), name: SCOPE.frequency },
	{ match: wb(alt(TIMING)), name: SCOPE.timing },
	{ match: wb(alt(ROUTE)), name: SCOPE.route },
	{ match: wb(alt(DISPENSING)), name: SCOPE.dispensing },
	{ match: wb(alt(FORMS)), name: SCOPE.form },
	{ match: wb(alt(COMPOUNDING)), name: SCOPE.compounding },
	{ match: wb(alt(CONDITIONAL)), name: SCOPE.conditional },
];

const punctuation: Pattern = {
	match: '[-.,;:()]',
	name: SCOPE.punctuation,
};

// Comments — doc variants must match first (#! before #, /** before /*).
const comments: Pattern[] = [
	{
		name: SCOPE.docCommentBlock,
		begin: '/\\*\\*',
		end: '\\*/',
	},
	{
		name: SCOPE.blockComment,
		begin: '/\\*',
		end: '\\*/',
	},
	{
		name: SCOPE.docCommentLine,
		match: '#!.*$',
	},
	{
		name: SCOPE.lineComment,
		match: '#.*$',
	},
];

// Shared body of every section — everything except the section-specific word
// fallback (ingredient vs signa vs dispense). Order matters: first match wins.
const sharedAtoms: Pattern[] = [
	...comments,
	warningAbbrev,
	dtdDirective,
	fillTo,
	compactFrequency,
	doseMatch,
	...latinAbbrevs,
	bareNumber,
	punctuation,
];

// ── top-level sections ──────────────────────────────────────────────────────
// Sections end only at the literal next marker (R/, Da/, D/, S/) or EOF.
// The trailing slash is load-bearing: without it, `s\b` inside `s.o.s.` would
// spuriously close a signa section because `.` is a non-word char.
const nextSection = '(?i)(?=R/|Da?/|S/)|\\z';

const rxSection: Pattern = {
	name: 'meta.section.rx.recipe',
	begin: '(?i)R/',
	beginCaptures: { '0': { name: SCOPE.rxMarker } },
	end: nextSection,
	patterns: [
		...sharedAtoms,
		{
			match: '[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\\-]*',
			name: SCOPE.ingredientWord,
		},
	],
};

const dispenseSection: Pattern = {
	name: 'meta.section.dispense.recipe',
	begin: '(?i)Da?/',
	beginCaptures: { '0': { name: SCOPE.dispenseMarker } },
	end: nextSection,
	patterns: [
		...sharedAtoms,
		{
			match: '[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\\-]*',
			name: SCOPE.dispenseWord,
		},
	],
};

const signaSection: Pattern = {
	name: 'meta.section.signa.recipe',
	begin: '(?i)S/',
	beginCaptures: { '0': { name: SCOPE.signaMarker } },
	end: nextSection,
	patterns: [
		...sharedAtoms,
		{
			match: '[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\\-]*',
			name: SCOPE.signaWord,
		},
	],
};

// ── assemble ────────────────────────────────────────────────────────────────
const grammar: Grammar = {
	$schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
	name: 'Recipe',
	scopeName: 'source.recipe',
	fileTypes: ['recipe', 'rx'],
	patterns: [
		...comments,
		rxSection,
		dispenseSection,
		signaSection,
		// Fallback at doc level — warnings outside any section, stray atoms.
		warningAbbrev,
	],
	repository: {
		comments: { patterns: comments },
		'shared-atoms': { patterns: sharedAtoms },
	},
};

// ── write ───────────────────────────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '..', 'dist', 'recipe.tmLanguage.json');

writeFileSync(outPath, `${JSON.stringify(grammar, null, '\t')}\n`);

console.log(`wrote ${outPath}`);
console.log(`  ${countPatterns(grammar.patterns)} top-level patterns`);
console.log(
	`  vocab: ${FREQUENCY.length} frequency · ${TIMING.length}+${TIMING_MULTIWORD.length} timing · ${ROUTE.length}+${ROUTE_MULTIWORD.length} route · ${DISPENSING.length}+${DISPENSING_MULTIWORD.length} dispensing · ${FORMS.length}+${FORMS_MULTIWORD.length} forms · ${COMPOUNDING.length}+${COMPOUNDING_MULTIWORD.length} compounding · ${CONDITIONAL.length}+${CONDITIONAL_MULTIWORD.length} conditional · ${WARNING.length} warning · ${UNITS.length} units`,
);

function countPatterns(patterns: Pattern[]): number {
	let n = 0;
	for (const p of patterns) {
		n += 1;
		if ('patterns' in p && p.patterns) n += countPatterns(p.patterns);
	}
	return n;
}
