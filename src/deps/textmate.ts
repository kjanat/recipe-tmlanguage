import { createRequire } from "node:module";

export type { IOnigLib, StateStack } from "vscode-textmate";
const require = createRequire(import.meta.url);

const textmate: typeof import("vscode-textmate") = require("vscode-textmate");

export const { parseRawGrammar, Registry, INITIAL } = textmate;
