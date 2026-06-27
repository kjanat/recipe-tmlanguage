import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runCommand } from "@kjanat/dreamcli/testkit";

import { generateCmd } from "#bin/commands/generate";
import { verifyCmd } from "#bin/commands/verify";

const grammarPath = resolve(tmpdir(), "recipe.tmLanguage.cli-test.json");

test("generate writes a valid grammar and reports stats", async () => {
	const result = await runCommand(generateCmd, ["--out", grammarPath]);
	expect(result.exitCode).toBe(0);
	expect(result.error).toBeUndefined();
	expect(result.stdout.join("")).toContain("wrote");
	expect(() => JSON.parse(readFileSync(grammarPath, "utf-8"))).not.toThrow();
});

test("generate --quiet stays silent on success", async () => {
	const result = await runCommand(generateCmd, ["--out", grammarPath, "--quiet"]);
	expect(result.exitCode).toBe(0);
	expect(result.stdout).toEqual([]);
});

test("generate --json emits structured output", async () => {
	const result = await runCommand(generateCmd, ["--out", grammarPath], { jsonMode: true });
	expect(result.exitCode).toBe(0);
	const payload = JSON.parse(result.stdout.join(""));
	expect(payload.ok).toBe(true);
	expect(payload.stats.topLevelPatterns).toBeGreaterThan(0);
});

test("verify passes against the freshly generated grammar", async () => {
	await runCommand(generateCmd, ["--out", grammarPath, "--quiet"]);
	const result = await runCommand(verifyCmd, ["--grammar", grammarPath]);
	expect(result.exitCode).toBe(0);
	expect(result.stdout.join("")).toContain("assertions pass");
});

test("verify --json reports zero failures", async () => {
	await runCommand(generateCmd, ["--out", grammarPath, "--quiet"]);
	const result = await runCommand(verifyCmd, ["--grammar", grammarPath], { jsonMode: true });
	expect(result.exitCode).toBe(0);
	const payload = JSON.parse(result.stdout.join(""));
	expect(payload.failures).toEqual([]);
	expect(payload.pass).toBe(payload.total);
});
