import type { CST, Document } from "yaml";
import { Composer, Parser } from "yaml";
import type { Context } from "./context";

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
  const cstNodes: CST.Token[] = [];
  const nodes: Document.Parsed[] = [];

  /**
   * Process for Document
   */
  function processDoc(node: Document.Parsed) {
    for (const error of node.errors) {
      throw ctx.throwError(error.message, error.pos[0]);
    }
    // ignore warns
    // for (const error of doc.warnings) {
    //     throw ctx.throwError(error.message, error.pos[0])
    // }
    nodes.push(node);
  }

  for (const cst of parser.parse(ctx.code)) {
    cstNodes.push(cst);
    for (const doc of composer.next(cst)) {
      processDoc(doc);
    }
  }
  for (const doc of composer.end()) {
    processDoc(doc);
  }

  return { nodes, cstNodes, streamInfo: composer.streamInfo() };
}
