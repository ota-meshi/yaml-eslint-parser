import { parseForESLint } from "./parser";
import type * as AST from "./ast";
import { traverseNodes } from "./traverse";
import { getStaticYAMLValue } from "./utils";
import { KEYS } from "./visitor-keys";
import { ParseError } from "./errors";
export * as meta from "./meta";
export { name } from "./meta";

export type { AST };
export { ParseError };

// parser
export { parseForESLint };
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS;

// tools
export { traverseNodes, getStaticYAMLValue };

/**
 * Parse YAML source code
 */
export function parseYAML(code: string, options?: any): AST.YAMLProgram {
  return parseForESLint(code, options).ast;
}

// Default export for compatibility
export default {
  parseForESLint,
  parseYAML,
  VisitorKeys,
  traverseNodes,
  getStaticYAMLValue,
  ParseError,
};
