import { convertRoot } from "./convert.ts";
import type { YAMLProgram } from "./ast.ts";
import { Context } from "./context.ts";
import { parseAllDocsToCST } from "./yaml-cst-parse.ts";

/**
 * Parse YAML source code
 */
export function parseYAML(code: string, options?: any): YAMLProgram {
  const ctx = new Context(code, options);

  const docs = parseAllDocsToCST(ctx);

  const ast = convertRoot(docs, ctx);

  return ast;
}
