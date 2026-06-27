import { expect, test } from "bun:test";

import { buildGrammar, serializeGrammar } from "#src/grammar.ts";

test("buildGrammar yields a populated source.recipe grammar", () => {
	const { grammar, stats } = buildGrammar();
	expect(grammar.scopeName).toBe("source.recipe");
	expect(grammar.patterns.length).toBeGreaterThan(0);
	expect(stats.topLevelPatterns).toBeGreaterThan(0);
});

test("every vocab category contributes terms", () => {
	const { vocab } = buildGrammar().stats;
	expect(vocab.frequency).toBeGreaterThan(0);
	expect(vocab.timing.single + vocab.timing.multi).toBeGreaterThan(0);
	expect(vocab.route.single + vocab.route.multi).toBeGreaterThan(0);
	expect(vocab.dispensing.single + vocab.dispensing.multi).toBeGreaterThan(0);
	expect(vocab.forms.single + vocab.forms.multi).toBeGreaterThan(0);
	expect(vocab.compounding.single + vocab.compounding.multi).toBeGreaterThan(0);
	expect(vocab.conditional.single + vocab.conditional.multi).toBeGreaterThan(0);
	expect(vocab.warning).toBeGreaterThan(0);
	expect(vocab.units).toBeGreaterThan(0);
});

test("serializeGrammar round-trips through JSON", () => {
	const { grammar } = buildGrammar();
	const parsed = JSON.parse(serializeGrammar(grammar, "tab"));
	expect(parsed.scopeName).toBe(grammar.scopeName);
	expect(parsed.patterns.length).toBe(grammar.patterns.length);
});
