import type { SourceCode } from "eslint";
import { parseYAML } from "./parser.ts";
import type * as AST from "./ast.ts";
import { traverseNodes } from "./traverse.ts";
import { getStaticYAMLValue } from "./utils.ts";
import { KEYS } from "./visitor-keys.ts";
import { ParseError } from "./errors.ts";
export * as meta from "./meta.ts";
export { name } from "./meta.ts";

export type { AST };
export { ParseError };

// parser
export { parseYAML };
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS;

// tools
export { traverseNodes, getStaticYAMLValue };

/**
 * Parse source code
 */
export function parseForESLint(
  code: string,
  options?: any,
): {
  ast: AST.YAMLProgram;
  visitorKeys: SourceCode.VisitorKeys;
  services: { isYAML: boolean };
} {
  const ast = parseYAML(code, options);

  return {
    ast,
    visitorKeys: KEYS,
    services: {
      isYAML: true,
    },
  };
}
