import type { SourceCode } from "eslint";
import { parseYAML } from "./parser";
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
