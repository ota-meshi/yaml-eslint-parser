import type { CST, Document } from "yaml";
import { Composer, Parser } from "yaml";
import type { Context } from "./context.ts";

export type ParsedCSTDocs = {
  cstNodes: CST.Token[];
  nodes: Document.Parsed[];
  streamInfo: ReturnType<Composer["streamInfo"]>;
};

/** Parse yaml to CST */
export function parseAllDocsToCST(ctx: Context): ParsedCSTDocs {
  const { lineCounter } = ctx;
  const parser = new Parser(lineCounter.addNewLine);
  const composer = new Composer({
    ...ctx.options,
    keepSourceTokens: true,
    lineCounter,
  });
  const cstNodes: CST.Token[] = [...parser.parse(ctx.code)];
  const nodes: Document.Parsed[] = [];
  for (const doc of composer.compose(cstNodes)) {
    for (const error of doc.errors) {
      throw ctx.throwError(error.message, error.pos[0]);
    }
    // ignore warns
    // for (const error of doc.warnings) {
    //     throw ctx.throwError(error.message, error.pos[0])
    // }
    nodes.push(doc);
  }

  return { nodes, cstNodes, streamInfo: composer.streamInfo() };
}
