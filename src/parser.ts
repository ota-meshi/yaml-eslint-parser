import type { SourceCode } from "eslint";
import { KEYS } from "./visitor-keys";
import { convertRoot } from "./convert";
import type { YAMLProgram } from "./ast";
import { Context } from "./context";
import { parseAllDocsToCST } from "./yaml-cst-parse";
/**
 * Parse source code
 */
export function parseForESLint(
  code: string,
  options?: any,
): {
  ast: YAMLProgram;
  visitorKeys: SourceCode.VisitorKeys;
  services: { isYAML: boolean };
} {
  const ctx = new Context(code, options);

  const docs = parseAllDocsToCST(ctx);

  const ast = convertRoot(docs, ctx);

  return {
    ast,
    visitorKeys: KEYS,
    services: {
      isYAML: true,
    },
  };
}
