import { convertRoot } from "./convert";
import type { YAMLProgram } from "./ast";
import { Context } from "./context";
import { parseAllDocsToCST } from "./yaml-cst-parse";

/**
 * Parse YAML source code
 */
export function parseYAML(code: string, options?: any): YAMLProgram {
  const ctx = new Context(code, options);

  const docs = parseAllDocsToCST(ctx);

  const ast = convertRoot(docs, ctx);

  return ast;
}
