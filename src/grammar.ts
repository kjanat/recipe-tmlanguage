/**
 * @file Pure grammar builder — imports the tree-sitter-recipe vocabulary and
 * compiles it into a TextMate grammar object. No filesystem I/O; the CLI
 * handles serialization and writes.
 *
 * Scopes are standard TextMate names with a `.recipe` suffix so themes paint
 * recipe blocks without a custom theme shipment.
 */
import { COMPOUNDING, COMPOUNDING_MULTIWORD } from "tree-sitter-recipe/grammar/latin/compounding.js";
import { CONDITIONAL, CONDITIONAL_MULTIWORD } from "tree-sitter-recipe/grammar/latin/conditional.js";
import { DISPENSING, DISPENSING_MULTIWORD } from "tree-sitter-recipe/grammar/latin/dispensing.js";
import { FORMS, FORMS_MULTIWORD } from "tree-sitter-recipe/grammar/latin/forms.js";
import { FREQUENCY } from "tree-sitter-recipe/grammar/latin/frequency.js";
import { ROUTE, ROUTE_MULTIWORD } from "tree-sitter-recipe/grammar/latin/route.js";
import { TIMING, TIMING_MULTIWORD } from "tree-sitter-recipe/grammar/latin/timing.js";
import { WARNING } from "tree-sitter-recipe/grammar/latin/warning.js";
import { UNITS } from "tree-sitter-recipe/grammar/units/index.js";

// ── scope map ───────────────────────────────────────────────────────────────
export const SCOPE = {
	rxMarker: "keyword.control.directive.rx.recipe",
	dispenseMarker: "keyword.control.directive.dispense.recipe",
	signaMarker: "keyword.control.directive.signa.recipe",

	frequency: "keyword.other.frequency.recipe",
	timing: "keyword.other.timing.recipe",
	route: "support.function.route.recipe",
	dispensing: "entity.other.attribute-name.recipe",
	warning: "invalid.illegal.warning.recipe",
	form: "storage.type.form.recipe",
	compounding: "keyword.operator.compounding.recipe",
	conditional: "keyword.control.conditional.recipe",

	fillMarker: "keyword.operator.fill.recipe",
	dtdKeyword: "keyword.operator.dtd.recipe",

	number: "constant.numeric.recipe",
	unit: "support.type.unit.recipe",

	lineComment: "comment.line.number-sign.recipe",
	docCommentLine: "comment.line.documentation.recipe",
	blockComment: "comment.block.recipe",
	docCommentBlock: "comment.block.documentation.recipe",

	punctuation: "punctuation.separator.recipe",

	ingredientWord: "variable.other.ingredient.recipe",
	signaWord: "string.unquoted.signa.recipe",
	dispenseWord: "variable.other.dispense.recipe",
} as const;

// ── regex helpers ───────────────────────────────────────────────────────────
// TextMate uses Oniguruma — first-match, not longest-match like tree-sitter —
// so we always sort alternatives longest-first before joining with `|`.
const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;

const escapeRegex = (s: string): string => s.replace(REGEX_METACHARS, "\\$&");

const alt = (items: readonly string[]): string =>
	[...new Set(items)]
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex)
		.join("|");

const altMultiword = (items: readonly string[]): string =>
	[...new Set(items)]
		.sort((a, b) => b.length - a.length)
		.map((s) => s.replace(/\./g, "\\.").replace(/\s+/g, "\\s+"))
		.join("|");

// Word boundary that treats `.` as part of the token so `a.c.` doesn't match
// inside `a.c.e.`. `\b` alone is not enough because `.` is non-word.
const wb = (pattern: string): string => `(?<![\\w.])(?:${pattern})(?![\\w.])`;

// ── types ───────────────────────────────────────────────────────────────────
type Capture = { name?: string; patterns?: Pattern[] };
type Captures = Record<string, Capture>;
export type Pattern =
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

export type Grammar = {
	$schema?: string;
	name: string;
	scopeName: string;
	fileTypes: string[];
	patterns: Pattern[];
	repository: Record<string, { patterns: Pattern[] } | Pattern>;
};

export type VocabStats = {
	frequency: number;
	timing: { single: number; multi: number };
	route: { single: number; multi: number };
	dispensing: { single: number; multi: number };
	forms: { single: number; multi: number };
	compounding: { single: number; multi: number };
	conditional: { single: number; multi: number };
	warning: number;
	units: number;
};

export type BuildStats = {
	topLevelPatterns: number;
	vocab: VocabStats;
};

export type BuildResult = {
	grammar: Grammar;
	stats: BuildStats;
};

// ── grammar assembly ────────────────────────────────────────────────────────
export function buildGrammar(): BuildResult {
	// Dose must come before bare number, else "50" matches first and leaves
	// "mg" to fall to the word fallback.
	const doseMatch: Pattern = {
		match: `(\\d+(?:[.,]\\d+)?)\\s*(${alt(UNITS)})(?![A-Za-zÀ-ÿ])`,
		captures: {
			"1": { name: SCOPE.number },
			"2": { name: SCOPE.unit },
		},
	};

	const bareNumber: Pattern = {
		match: "\\d+(?:[.,]\\d+)?",
		name: SCOPE.number,
	};

	const compactFrequency: Pattern = {
		match: "[1-9]\\s*dd(?![A-Za-zÀ-ÿ0-9])",
		name: SCOPE.frequency,
	};

	// `ad` is a word too; only paint as fill-marker when followed by digit.
	const fillTo: Pattern = {
		match: "\\bad\\b(?=\\s+\\d)",
		name: SCOPE.fillMarker,
	};

	const dtdDirective: Pattern = {
		match: "(?i)(?<![\\w.])(d\\.?t\\.?d\\.?)(?:\\s+(no))?(?=\\s+\\d)",
		captures: {
			"1": { name: SCOPE.dtdKeyword },
			"2": { name: SCOPE.dtdKeyword },
		},
	};

	// Case-sensitive — CITO/cito/Cito are separate vocab entries. Painted red.
	const warningAbbrev: Pattern = {
		match: wb(alt(WARNING)),
		name: SCOPE.warning,
	};

	// Multiword first (longer match wins), then dotted singles. All word-bounded.
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
		match: "[-.,;:()]",
		name: SCOPE.punctuation,
	};

	// Doc variants must match before their plain counterparts (#! before #, /** before /*).
	const comments: Pattern[] = [
		{ name: SCOPE.docCommentBlock, begin: "/\\*\\*", end: "\\*/" },
		{ name: SCOPE.blockComment, begin: "/\\*", end: "\\*/" },
		{ name: SCOPE.docCommentLine, match: "#!.*$" },
		{ name: SCOPE.lineComment, match: "#.*$" },
	];

	// Shared atoms inside every section. Order = first-match priority.
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

	// Sections end only at the literal next marker (R/, Da/, D/, S/) or EOF.
	// The trailing slash is load-bearing: without it, `s\b` inside `s.o.s.`
	// would spuriously close a signa section because `.` is non-word.
	const nextSection = "(?i)(?=R/|Da?/|S/)|\\z";

	const makeSection = (begin: string, marker: string, wordScope: string): Pattern => ({
		name: `meta.section.${wordScope.split(".")[2] ?? "unknown"}.recipe`,
		begin,
		beginCaptures: { "0": { name: marker } },
		end: nextSection,
		patterns: [
			...sharedAtoms,
			{ match: "[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\\-]*", name: wordScope },
		],
	});

	const rxSection = makeSection("(?i)R/", SCOPE.rxMarker, SCOPE.ingredientWord);
	const dispenseSection = makeSection("(?i)Da?/", SCOPE.dispenseMarker, SCOPE.dispenseWord);
	const signaSection = makeSection("(?i)S/", SCOPE.signaMarker, SCOPE.signaWord);

	const grammar: Grammar = {
		$schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
		name: "Recipe",
		scopeName: "source.recipe",
		fileTypes: ["recipe", "rx"],
		patterns: [
			...comments,
			rxSection,
			dispenseSection,
			signaSection,
			warningAbbrev,
		],
		repository: {
			comments: { patterns: comments },
			"shared-atoms": { patterns: sharedAtoms },
		},
	};

	const stats: BuildStats = {
		topLevelPatterns: countPatterns(grammar.patterns),
		vocab: {
			frequency: FREQUENCY.length,
			timing: { single: TIMING.length, multi: TIMING_MULTIWORD.length },
			route: { single: ROUTE.length, multi: ROUTE_MULTIWORD.length },
			dispensing: { single: DISPENSING.length, multi: DISPENSING_MULTIWORD.length },
			forms: { single: FORMS.length, multi: FORMS_MULTIWORD.length },
			compounding: { single: COMPOUNDING.length, multi: COMPOUNDING_MULTIWORD.length },
			conditional: { single: CONDITIONAL.length, multi: CONDITIONAL_MULTIWORD.length },
			warning: WARNING.length,
			units: UNITS.length,
		},
	};

	return { grammar, stats };
}

function countPatterns(patterns: Pattern[]): number {
	let n = 0;
	for (const p of patterns) {
		n += 1;
		if ("patterns" in p && p.patterns) n += countPatterns(p.patterns);
	}
	return n;
}

export function serializeGrammar(g: Grammar, indent: "tab" | number): string {
	const space = indent === "tab" ? "\t" : indent;
	return `${JSON.stringify(g, null, space)}\n`;
}
