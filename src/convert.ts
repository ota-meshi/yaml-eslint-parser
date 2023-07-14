import type {
  Range,
  Locations,
  Token,
  Comment,
  YAMLProgram,
  YAMLDocument,
  YAMLDirective,
  YAMLContent,
  YAMLBlockMapping,
  YAMLFlowMapping,
  YAMLPair,
  YAMLPlainScalar,
  YAMLBlockSequence,
  YAMLFlowSequence,
  YAMLDoubleQuotedScalar,
  YAMLSingleQuotedScalar,
  YAMLBlockLiteralScalar,
  YAMLBlockFoldedScalar,
  YAMLAlias,
  YAMLAnchor,
  YAMLTag,
  YAMLWithMeta,
  YAMLSequence,
  YAMLNode,
  Position,
  SourceLocation,
} from "./ast";
import type { Context } from "./context";
import { tagResolvers } from "./tags";
import type { YAMLVersion } from "./utils";
import type {
  Alias,
  CST,
  Document,
  Pair as BasePair,
  ParsedNode,
  Scalar,
  YAMLMap,
  YAMLSeq,
} from "yaml";
import {
  isDocument,
  isPair as isBasePair,
  isAlias,
  isScalar,
  isSeq,
  isMap,
} from "yaml";
import type { ParsedCSTDocs } from "./yaml-cst-parse";

type PairParsed = BasePair<ParsedNode, ParsedNode | null>;
type Directives = Document.Parsed["directives"];

const isPair = isBasePair as (node: any) => node is PairParsed;

class PreTokens {
  private readonly ctx: Context;

  private readonly array: (
    | CommentOrSpaceOrErrorSourceToken
    | NormalSourceToken
  )[];

  private index = 0;

  public constructor(array: CST.SourceToken[], ctx: Context) {
    this.array = array;
    this.ctx = ctx;
  }

  public first(): NormalSourceToken | null {
    let cst;
    while ((cst = this.array[this.index])) {
      if (processCommentOrSpace(cst, this.ctx)) {
        this.index++;
        continue;
      }
      return cst;
    }
    return null;
  }

  public consume(): NormalSourceToken | null {
    const cst = this.first();
    if (cst) {
      this.index++;
    }
    return cst;
  }

  public back() {
    this.index--;
  }

  public each(callback: (cst: NormalSourceToken) => void) {
    let cst;
    while ((cst = this.consume())) {
      callback(cst);
    }
  }
}

/** Checks whether the give cst node is plain scaler */
function isPlainScalarCST(
  cst: CST.FlowScalar,
): cst is CST.FlowScalar & { type: "scalar" } {
  return cst.type === "scalar";
}

/** Checks whether the give cst node is double-quoted-scalar */
function isDoubleQuotedScalarCST(
  cst: CST.FlowScalar,
): cst is CST.FlowScalar & { type: "double-quoted-scalar" } {
  return cst.type === "double-quoted-scalar";
}

/** Checks whether the give cst node is single-quoted-scalar */
function isSingleQuotedScalarCST(
  cst: CST.FlowScalar,
): cst is CST.FlowScalar & { type: "single-quoted-scalar" } {
  return cst.type === "single-quoted-scalar";
}

/** Checks whether the give cst node is alias scalar */
function isAliasScalarCST(
  cst: CST.FlowScalar,
): cst is CST.FlowScalar & { type: "alias" } {
  return cst.type === "alias";
}

/** Checks whether the give cst node is anchor */
function isAnchorCST(
  cst: CST.SourceToken,
): cst is CST.SourceToken & { type: "anchor" } {
  return cst.type === "anchor";
}

/** Checks whether the give cst node is tag */
function isTagCST(
  cst: CST.SourceToken,
): cst is CST.SourceToken & { type: "tag" } {
  return cst.type === "tag";
}

/** Get node type name */
function getNodeType(node: any) {
  /* istanbul ignore next */
  return isMap(node)
    ? "MAP"
    : isSeq(node)
    ? "SEQ"
    : isScalar(node)
    ? "SCALAR"
    : isAlias(node)
    ? "ALIAS"
    : isPair(node)
    ? "PAIR"
    : isDocument(node)
    ? "DOCUMENT"
    : "unknown";
}

type CSTDoc = {
  doc: CST.Document;
  directives: CST.Directive[];
  docEnd?: CST.DocumentEnd;
};
/**
 * Convert yaml root to YAMLProgram
 */
export function convertRoot(docs: ParsedCSTDocs, ctx: Context): YAMLProgram {
  const { cstNodes, nodes } = docs;
  const ast: YAMLProgram = {
    type: "Program",
    body: [],
    comments: ctx.comments,
    sourceType: "module",
    tokens: ctx.tokens,
    parent: null,
    ...ctx.getConvertLocation(0, ctx.code.length),
  };
  let directives: CST.Directive[] = [];
  let bufferDoc: CSTDoc | null = null;
  const cstDocs: CSTDoc[] = [];
  for (const n of cstNodes) {
    if (processCommentOrSpace(n, ctx)) {
      continue;
    }
    if (n.type === "doc-end") {
      /* istanbul ignore if */
      if (!bufferDoc) {
        throw ctx.throwUnexpectedTokenError(n);
      }
      bufferDoc.docEnd = n;
      cstDocs.push(bufferDoc);
      bufferDoc = null;
      n.end?.forEach((t) => processAnyToken(t, ctx));
      continue;
    }
    if (bufferDoc) {
      cstDocs.push(bufferDoc);
      bufferDoc = null;
    }
    if (n.type === "directive") {
      directives.push(n);
      continue;
    }
    if (n.type === "document") {
      bufferDoc = {
        doc: n,
        directives,
      };
      directives = [];
      continue;
    }
    /* istanbul ignore next */
    throw ctx.throwUnexpectedTokenError(n);
  }
  if (bufferDoc) {
    cstDocs.push(bufferDoc);
    bufferDoc = null;
  }
  if (cstDocs.length > 0) {
    let startIndex = 0;
    ast.body = cstDocs.map((doc, index) => {
      const result = convertDocument(doc, nodes[index], ctx, ast, startIndex);
      startIndex = result.range[1];
      return result;
    });
  } else {
    const index = skipSpaces(ctx.code, 0);
    ast.body.push({
      type: "YAMLDocument",
      directives: [],
      content: null,
      parent: ast,
      anchors: {},
      version: docs.streamInfo.directives.yaml.version,
      ...ctx.getConvertLocation(index, index),
    });
  }
  sort(ctx.comments);
  sort(ctx.tokens);

  const lastBody = ast.body[ast.body.length - 1];
  if (lastBody) {
    adjustEndLoc(lastBody, ctx.comments[ctx.comments.length - 1]);
  }
  return ast;
}

/**
 * Convert YAML.Document to YAMLDocument
 */
function convertDocument(
  { directives, doc, docEnd }: CSTDoc,
  node: Document.Parsed,
  ctx: Context,
  parent: YAMLProgram,
  startIndex: number,
): YAMLDocument {
  const loc = ctx.getConvertLocation(
    skipSpaces(ctx.code, startIndex),
    node.range[1],
  );
  const ast: YAMLDocument = {
    type: "YAMLDocument",
    directives: [],
    content: null,
    parent,
    anchors: {},
    version: node.directives.yaml.version,
    ...loc,
  };

  ast.directives.push(
    ...convertDocumentHead(node.directives, directives, ctx, ast),
  );
  let last: Locations | undefined = ast.directives[ast.directives.length - 1];

  const startTokens = new PreTokens(doc.start, ctx);

  let t;
  while ((t = startTokens.consume())) {
    if (t.type === "doc-start") {
      last = ctx.addToken("Marker", toRange(t));
      continue;
    }
    startTokens.back();
    break;
  }

  ast.content = convertDocumentBody(
    startTokens,
    doc.value || null,
    node.contents,
    ctx,
    ast,
  );
  last = ast.content || last;

  if (doc.end) {
    doc.end.forEach((token) => processAnyToken(token, ctx));
  }

  // Marker
  if (docEnd) {
    last = ctx.addToken("Marker", toRange(docEnd));
  }
  adjustEndLoc(ast, last);
  return ast;
}

/**
 * Convert YAML.Document.Parsed to YAMLDirective[]
 */
function* convertDocumentHead(
  node: Directives,
  directives: CST.Directive[],
  ctx: Context,
  parent: YAMLDocument,
): IterableIterator<YAMLDirective> {
  for (const n of directives) {
    yield convertDirective(node, n, ctx, parent);
  }
}

/**
 * Convert CSTDirective to YAMLDirective
 */
function convertDirective(
  node: Directives,
  cst: CST.Directive,
  ctx: Context,
  parent: YAMLDocument,
): YAMLDirective {
  const loc = ctx.getConvertLocation(...toRange(cst));

  const value = ctx.code.slice(...loc.range);

  const parts = cst.source.trim().split(/[\t ]+/);
  const name = parts.shift();

  let ast: YAMLDirective;
  if (name === "%YAML") {
    ast = {
      type: "YAMLDirective",
      value,
      kind: "YAML",
      version: node.yaml.version,
      parent,
      ...loc,
    };
  } else if (name === "%TAG") {
    const [handle, prefix] = parts;
    ast = {
      type: "YAMLDirective",
      value,
      kind: "TAG",
      handle,
      prefix,
      parent,
      ...loc,
    };
  } else {
    ast = {
      type: "YAMLDirective",
      value,
      kind: null,
      parent,
      ...loc,
    };
  }
  ctx.addToken("Directive", loc.range);
  return ast;
}

/**
 * Convert Document body to YAMLContent
 */
function convertDocumentBody(
  preTokens: PreTokens,
  cst: CST.Token | null,
  node: ParsedNode | null,
  ctx: Context,
  parent: YAMLDocument,
): YAMLContent | YAMLWithMeta | null {
  if (cst) {
    return convertContentNode(preTokens, cst, node, ctx, parent, parent);
  }
  const token = preTokens.first();
  /* istanbul ignore if */
  if (token) {
    throw ctx.throwUnexpectedTokenError(token);
  }
  return null;
}

/* eslint-disable complexity -- X */
/**
 * Convert ContentNode to YAMLContent
 */
function convertContentNode(
  /* eslint-enable complexity -- X */
  preTokens: PreTokens,
  cst: CST.Token,
  node: ParsedNode | null,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLContent | YAMLWithMeta {
  /* istanbul ignore if */
  if (!node) {
    throw ctx.throwError(
      `unknown error: AST is null. Unable to process content CST (${cst.type}).`,
      cst,
    );
  }
  /* istanbul ignore if */
  if (node.srcToken !== cst) {
    throw ctx.throwError(
      `unknown error: CST is mismatched. Unable to process content CST (${cst.type}: ${node.srcToken?.type}).`,
      cst,
    );
  }

  if (cst.type === "block-scalar") {
    /* istanbul ignore if */
    if (!isScalar(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Scalar (${getNodeType(
          node,
        )}). Unable to process Scalar CST.`,
        cst,
      );
    }
    return convertBlockScalar(preTokens, cst, node, ctx, parent, doc);
  }
  if (cst.type === "block-seq") {
    /* istanbul ignore if */
    if (!isSeq(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Seq (${getNodeType(
          node,
        )}). Unable to process Seq CST.`,
        cst,
      );
    }
    return convertSequence(preTokens, cst, node, ctx, parent, doc);
  }
  if (cst.type === "block-map") {
    /* istanbul ignore if */
    if (!isMap(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Map and Pair (${getNodeType(
          node,
        )}). Unable to process Map CST.`,
        cst,
      );
    }
    return convertMapping(preTokens, cst, node, ctx, parent, doc);
  }
  if (cst.type === "flow-collection") {
    return convertFlowCollection(preTokens, cst, node, ctx, parent, doc);
  }
  if (isPlainScalarCST(cst)) {
    /* istanbul ignore if */
    if (!isScalar(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Scalar (${getNodeType(
          node,
        )}). Unable to process Scalar CST.`,
        cst,
      );
    }
    return convertPlain(preTokens, cst, node, ctx, parent, doc);
  }
  if (isDoubleQuotedScalarCST(cst)) {
    /* istanbul ignore if */
    if (!isScalar(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Scalar (${getNodeType(
          node,
        )}). Unable to process Scalar CST.`,
        cst,
      );
    }
    return convertQuoteDouble(preTokens, cst, node, ctx, parent, doc);
  }
  if (isSingleQuotedScalarCST(cst)) {
    /* istanbul ignore if */
    if (!isScalar(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Scalar (${getNodeType(
          node,
        )}). Unable to process Scalar CST.`,
        cst,
      );
    }
    return convertQuoteSingle(preTokens, cst, node, ctx, parent, doc);
  }
  if (isAliasScalarCST(cst)) {
    /* istanbul ignore if */
    if (!isAlias(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Alias (${getNodeType(
          node,
        )}). Unable to process Alias CST.`,
        cst,
      );
    }
    return convertAlias(preTokens, cst, node, ctx, parent, doc);
  }

  /* istanbul ignore next */
  throw new Error(`Unsupported node: ${cst.type}`);
}

/* eslint-disable complexity -- X */
/**
 * Convert Map to YAMLBlockMapping
 */
function convertMapping(
  /* eslint-enable complexity -- X */
  preTokens: PreTokens,
  cst: CST.BlockMap,
  node: YAMLMap.Parsed | PairParsed,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLSequence,
  doc: YAMLDocument,
): YAMLBlockMapping | YAMLWithMeta {
  if (isPair(node)) {
    /* istanbul ignore if */
    if (node.srcToken !== cst.items[0]) {
      throw ctx.throwError(
        `unknown error: CST is mismatched. Unable to process mapping CST (${cst.type}: "CollectionItem").`,
        cst,
      );
    }
  } else {
    /* istanbul ignore if */
    if (node.srcToken !== cst) {
      throw ctx.throwError(
        `unknown error: CST is mismatched. Unable to process mapping CST (${cst.type}: ${node.srcToken?.type}).`,
        cst,
      );
    }
  }
  const loc = ctx.getConvertLocation(cst.offset, cst.offset);
  const ast: YAMLBlockMapping = {
    type: "YAMLMapping",
    style: "block",
    pairs: [],
    parent,
    ...loc,
  };
  const items = getPairs(node);
  let firstKeyInd;
  let lastKeyInd;
  for (const item of cst.items) {
    const startTokens = new PreTokens(item.start, ctx);
    let token;
    let keyInd: Token | null = null;
    while ((token = startTokens.consume())) {
      if (token.type === "explicit-key-ind") {
        /* istanbul ignore if */
        if (keyInd) {
          throw ctx.throwUnexpectedTokenError(token);
        }
        lastKeyInd = keyInd = ctx.addToken("Punctuator", toRange(token));
        firstKeyInd ??= keyInd;
        continue;
      }
      startTokens.back();
      break;
    }
    const pair = items.shift();
    if (!pair) {
      const t =
        startTokens.first() ||
        keyInd ||
        item.key ||
        item.sep?.[0] ||
        item.value;
      if (!t) {
        // trailing spaces
        break;
      }
      /* istanbul ignore next */
      throw ctx.throwUnexpectedTokenError(t);
    }
    ast.pairs.push(
      convertMappingItem(keyInd, startTokens, item, pair, ctx, ast, doc),
    );
  }
  adjustStartLoc(ast, firstKeyInd);
  adjustStartLoc(ast, ast.pairs[0]);
  adjustEndLoc(ast, ast.pairs[ast.pairs.length - 1] || lastKeyInd);
  if (!isMap(node)) {
    return ast;
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);
}

/**
 * Convert FlowCollection to YAMLFlowMapping
 */
function convertFlowCollection(
  preTokens: PreTokens,
  cst: CST.FlowCollection,
  node: ParsedNode | PairParsed,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLFlowMapping | YAMLFlowSequence | YAMLWithMeta {
  if (cst.start.type === "flow-map-start") {
    const startToken = ctx.addToken("Punctuator", toRange(cst.start));
    /* istanbul ignore if */
    if (!isMap(node) && !isPair(node)) {
      throw ctx.throwError(
        `unknown error: AST is not Map and Pair (${getNodeType(
          node,
        )}). Unable to process flow map CST.`,
        cst,
      );
    }
    return convertFlowMapping(
      preTokens,
      startToken,
      cst,
      node,
      ctx,
      parent,
      doc,
    );
  }

  if (cst.start.type === "flow-seq-start") {
    const startToken = ctx.addToken("Punctuator", toRange(cst.start));

    /* istanbul ignore if */
    if (!isSeq(node) || !node.flow) {
      throw ctx.throwError(
        `unknown error: AST is not flow Seq (${getNodeType(
          node,
        )}). Unable to process flow seq CST.`,
        cst,
      );
    }
    return convertFlowSequence(
      preTokens,
      startToken,
      cst,
      node,
      ctx,
      parent,
      doc,
    );
  }
  /* istanbul ignore next */
  throw ctx.throwUnexpectedTokenError(cst.start);
}

/* eslint-disable complexity -- X */
/**
 * Convert FlowMap to YAMLFlowMapping
 */
function convertFlowMapping(
  /* eslint-enable complexity -- X */
  preTokens: PreTokens,
  startToken: Token,
  cst: CST.FlowCollection,
  node: YAMLMap.Parsed | PairParsed,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLFlowMapping | YAMLWithMeta {
  const loc = ctx.getConvertLocation(startToken.range[0], cst.offset);
  const ast: YAMLFlowMapping = {
    type: "YAMLMapping",
    style: "flow",
    pairs: [],
    parent,
    ...loc,
  };
  const items = getPairs(node);
  let lastToken;
  for (const item of cst.items) {
    const startTokens = new PreTokens(item.start, ctx);
    let token;
    let keyInd: Token | null = null;
    while ((token = startTokens.consume())) {
      if (token.type === "comma") {
        lastToken = ctx.addToken("Punctuator", toRange(token));
        continue;
      }
      if (token.type === "explicit-key-ind") {
        /* istanbul ignore if */
        if (keyInd) {
          throw ctx.throwUnexpectedTokenError(token);
        }
        lastToken = keyInd = ctx.addToken("Punctuator", toRange(token));
        continue;
      }
      startTokens.back();
      break;
    }
    const pair = items.shift();
    if (!pair) {
      const t =
        startTokens.first() ||
        keyInd ||
        item.key ||
        item.sep?.[0] ||
        item.value;
      if (!t) {
        // trailing spaces
        break;
      }
      /* istanbul ignore next */
      throw ctx.throwUnexpectedTokenError(t);
    }
    ast.pairs.push(
      convertMappingItem(keyInd, startTokens, item, pair, ctx, ast, doc),
    );
  }
  let mapEnd;
  for (const token of cst.end) {
    if (processCommentOrSpace(token, ctx)) {
      continue;
    }
    if (token.type === "flow-map-end") {
      mapEnd = ctx.addToken("Punctuator", toRange(token));
      continue;
    }
    /* istanbul ignore next */
    throw ctx.throwUnexpectedTokenError(token);
  }
  adjustEndLoc(ast, mapEnd || ast.pairs[ast.pairs.length - 1] || lastToken);
  if (!isMap(node)) {
    return ast;
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);
}

/* eslint-disable complexity -- X */
/**
 * Convert FlowSeq to YAMLFlowSequence
 */
function convertFlowSequence(
  /* eslint-enable complexity -- X */
  preTokens: PreTokens,
  startToken: Token,
  cst: CST.FlowCollection,
  node: YAMLSeq.Parsed<ParsedNode | PairParsed>,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLFlowSequence | YAMLWithMeta {
  const loc = ctx.getConvertLocation(startToken.range[0], cst.offset);
  const ast: YAMLFlowSequence = {
    type: "YAMLSequence",
    style: "flow",
    entries: [],
    parent,
    ...loc,
  };
  let lastToken;
  const items = [...node.items];
  for (const item of cst.items) {
    const startTokens = new PreTokens(item.start, ctx);
    let token;
    while ((token = startTokens.consume())) {
      if (token.type === "comma") {
        lastToken = ctx.addToken("Punctuator", toRange(token));
        continue;
      }
      startTokens.back();
      break;
    }
    if (items.length === 0) {
      const t = startTokens.first() || item.key || item.sep?.[0] || item.value;
      if (!t) {
        // trailing spaces or comma
        break;
      }
      /* istanbul ignore next */
      throw ctx.throwUnexpectedTokenError(t);
    }
    const entry = items.shift();
    if (isPair(entry) || ((item.key || item.sep) && isMap(entry))) {
      ast.entries.push(convertMap(startTokens, item, entry));
    } else {
      ast.entries.push(
        convertFlowSequenceItem(
          startTokens,
          item.value || null,
          entry || null,
          ctx,
          ast,
          doc,
          (ast.entries[ast.entries.length - 1] || lastToken || startToken)
            .range[1],
        ),
      );
    }
  }
  let seqEnd;
  for (const token of cst.end) {
    if (processCommentOrSpace(token, ctx)) {
      continue;
    }
    if (token.type === "flow-seq-end") {
      seqEnd = ctx.addToken("Punctuator", toRange(token));
      continue;
    }
    /* istanbul ignore next */
    throw ctx.throwUnexpectedTokenError(token);
  }
  adjustEndLoc(ast, seqEnd || ast.entries[ast.entries.length - 1] || lastToken);

  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);

  /** Convert CollectionItem to YAMLBlockMapping */
  function convertMap(
    pairPreTokens: PreTokens,
    pairCst: CST.CollectionItem,
    entry: YAMLMap.Parsed | PairParsed,
  ): YAMLBlockMapping {
    const startTokens = pairPreTokens;
    let keyInd: Token | null = null;
    let token;
    while ((token = startTokens.consume())) {
      if (token.type === "comma") {
        ctx.addToken("Punctuator", toRange(token));
        continue;
      }
      if (token.type === "explicit-key-ind") {
        /* istanbul ignore if */
        if (keyInd) {
          throw ctx.throwUnexpectedTokenError(token);
        }
        keyInd = ctx.addToken("Punctuator", toRange(token));
        continue;
      }
      startTokens.back();
      break;
    }
    const pairStartToken = pairCst.key ?? pairCst.sep![0];
    const mapAst: YAMLBlockMapping = {
      type: "YAMLMapping",
      style: "block",
      pairs: [],
      parent: ast,
      ...ctx.getConvertLocation(
        keyInd?.range[0] ?? pairStartToken.offset,
        keyInd?.range[1] ?? pairStartToken.offset,
      ),
    };

    const pair = convertMappingItem(
      keyInd,
      startTokens,
      pairCst,
      getPairs(entry)[0],
      ctx,
      mapAst,
      doc,
    );
    mapAst.pairs.push(pair);

    adjustStartLoc(mapAst, keyInd || pair);
    adjustEndLoc(mapAst, pair || keyInd);
    return mapAst;
  }
}

/**
 * Convert Pair to YAMLPair
 */
function convertMappingItem(
  keyInd: Token | null,
  preTokens: PreTokens,
  cst: CST.BlockMap["items"][number] | CST.CollectionItem,
  node: PairParsed,
  ctx: Context,
  parent: YAMLBlockMapping | YAMLFlowMapping,
  doc: YAMLDocument,
): YAMLPair {
  const start =
    keyInd?.range[0] ??
    preTokens.first()?.offset ??
    cst.key?.offset ??
    cst.sep?.[0]?.offset ??
    cst.value?.offset ??
    -1;
  const loc = ctx.getConvertLocation(start, start);
  const ast: YAMLPair = {
    type: "YAMLPair",
    key: null,
    value: null,
    parent,
    ...loc,
  };
  ast.key = convertMappingKey(
    preTokens,
    cst.key || null,
    node.key,
    ctx,
    ast,
    doc,
    start,
  );
  const valueStartTokens = new PreTokens(cst.sep || [], ctx);
  let valueInd;
  let token;
  while ((token = valueStartTokens.consume())) {
    if (token.type === "map-value-ind") {
      /* istanbul ignore if */
      if (valueInd) {
        throw ctx.throwUnexpectedTokenError(token);
      }
      valueInd = ctx.addToken("Punctuator", toRange(token));
      continue;
    }
    valueStartTokens.back();
    break;
  }

  ast.value = convertMappingValue(
    valueStartTokens,
    cst.value || null,
    node.value,
    ctx,
    ast,
    doc,
    start,
  );
  adjustEndLoc(ast, ast.value || valueInd || ast.key || keyInd);
  return ast;
}

/**
 * Convert MapKey to YAMLContent
 */
function convertMappingKey(
  preTokens: PreTokens,
  cst: CST.Token | null,
  node: ParsedNode,
  ctx: Context,
  parent: YAMLPair,
  doc: YAMLDocument,
  indexForError: number,
): YAMLContent | YAMLWithMeta | null {
  if (cst) {
    return convertContentNode(preTokens, cst, node, ctx, parent, doc);
  }
  /* istanbul ignore if */
  if (!isScalarOrNull(node)) {
    throw ctx.throwError(
      `unknown error: AST is not Scalar and null (${getNodeType(
        node,
      )}). Unable to process empty map key CST.`,
      preTokens.first() ?? indexForError,
    );
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, null, doc, null);
}

/**
 * Convert MapValue to YAMLContent
 */
function convertMappingValue(
  preTokens: PreTokens,
  cst: CST.Token | null,
  node: ParsedNode | null,
  ctx: Context,
  parent: YAMLPair,
  doc: YAMLDocument,
  indexForError: number,
): YAMLContent | YAMLWithMeta | null {
  if (cst) {
    return convertContentNode(preTokens, cst, node, ctx, parent, doc);
  }

  /* istanbul ignore if */
  if (!isScalarOrNull(node)) {
    throw ctx.throwError(
      `unknown error: AST is not Scalar and null (${getNodeType(
        node,
      )}). Unable to process empty map value CST.`,
      preTokens.first() ?? indexForError,
    );
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, null, doc, null);
}

/**
 * Convert BlockSeq to YAMLBlockSequence
 */
function convertSequence(
  preTokens: PreTokens,
  cst: CST.BlockSequence,
  node: YAMLSeq.Parsed,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLBlockSequence | YAMLWithMeta {
  const loc = ctx.getConvertLocation(cst.offset, cst.offset);
  const ast: YAMLBlockSequence = {
    type: "YAMLSequence",
    style: "block",
    entries: [],
    parent,
    ...loc,
  };
  const items = [...node.items];
  let lastSeqInd;
  for (const item of cst.items) {
    const startTokens = new PreTokens(item.start, ctx);
    let seqInd;
    let token;
    while ((token = startTokens.consume())) {
      if (token.type === "seq-item-ind") {
        /* istanbul ignore if */
        if (seqInd) {
          throw ctx.throwUnexpectedTokenError(token);
        }
        lastSeqInd = seqInd = ctx.addToken("Punctuator", toRange(token));
        continue;
      }
      startTokens.back();
      break;
    }

    if (items.length === 0) {
      const t = startTokens.first() || item.key || item.sep?.[0] || item.value;
      if (!t) {
        // trailing spaces or comma
        break;
      }
      /* istanbul ignore next */
      throw ctx.throwUnexpectedTokenError(t);
    }

    ast.entries.push(
      convertSequenceItem(
        startTokens,
        item,
        items.shift() || null,
        ctx,
        ast,
        doc,
        (ast.entries[ast.entries.length - 1] || ast).range[1],
      ),
    );
  }
  adjustEndLoc(ast, ast.entries[ast.entries.length - 1] || lastSeqInd);
  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);
}

/**
 * Convert SeqItem to YAMLContent
 */
function convertSequenceItem(
  preTokens: PreTokens,
  cst: CST.BlockSequence["items"][number],
  node: ParsedNode | PairParsed | null,
  ctx: Context,
  parent: YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
  indexForError: number,
): YAMLContent | YAMLWithMeta {
  /* istanbul ignore if */
  if (cst.key) {
    throw ctx.throwUnexpectedTokenError(cst.key);
  }
  /* istanbul ignore if */
  if (cst.sep) {
    throw ctx.throwUnexpectedTokenError(cst.sep);
  }
  if (cst.value) {
    if (isPair(node)) {
      if (cst.value.type === "block-map") {
        return convertMapping(preTokens, cst.value, node, ctx, parent, doc);
      }
      if (cst.value.type === "flow-collection") {
        return convertFlowCollection(
          preTokens,
          cst.value,
          node,
          ctx,
          parent,
          doc,
        );
      }
      throw ctx.throwError(
        `unknown error: CST is not block-map and flow-collection (${cst.value.type}). Unable to process Pair AST.`,
        cst.value,
      );
    }
    return convertContentNode(preTokens, cst.value, node, ctx, parent, doc);
  }
  /* istanbul ignore if */
  if (!isScalarOrNull(node)) {
    throw ctx.throwError(
      `unknown error: AST is not Scalar and null (${getNodeType(
        node,
      )}). Unable to process empty seq item CST.`,
      preTokens.first() ?? indexForError,
    );
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, null, doc, null);
}

/**
 * Convert FlowSeqItem to YAMLContent
 */
function convertFlowSequenceItem(
  preTokens: PreTokens,
  cst: CST.Token | null,
  node: ParsedNode | null,
  ctx: Context,
  parent: YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
  indexForError: number,
): YAMLContent | YAMLWithMeta {
  if (cst) {
    return convertContentNode(preTokens, cst, node, ctx, parent, doc);
  }

  /* istanbul ignore if */
  if (!isScalarOrNull(node)) {
    throw ctx.throwError(
      `unknown error: AST is not Scalar and null (${getNodeType(
        node,
      )}). Unable to process empty seq item CST.`,
      preTokens.first() ?? indexForError,
    );
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, null, doc, null);
}

/**
 * Convert PlainValue to YAMLPlainScalar
 */
function convertPlain(
  preTokens: PreTokens,
  cst: CST.FlowScalar & { type: "scalar" },
  node: Scalar,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLPlainScalar | YAMLWithMeta {
  const loc = ctx.getConvertLocation(...toRange(cst));

  let ast: YAMLPlainScalar | YAMLWithMeta;
  if (loc.range[0] < loc.range[1]) {
    const strValue = node.source || cst.source;
    const value = parseValueFromText(strValue, doc.version || "1.2");

    ast = {
      type: "YAMLScalar",
      style: "plain",
      strValue,
      value,
      raw: ctx.code.slice(...loc.range),
      parent,
      ...loc,
    };

    const type = typeof value;
    if (type === "boolean") {
      ctx.addToken("Boolean", loc.range);
    } else if (type === "number" && isFinite(Number(value))) {
      ctx.addToken("Numeric", loc.range);
    } else if (value === null) {
      ctx.addToken("Null", loc.range);
    } else {
      ctx.addToken("Identifier", loc.range);
    }
    ast = convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, loc);
  } else {
    ast = convertAnchorAndTag<YAMLPlainScalar>(
      preTokens,
      node,
      ctx,
      parent,
      null,
      doc,
      loc,
    );
  }

  cst.end?.forEach((t) => processAnyToken(t, ctx));

  return ast;

  /**
   * Parse value from text
   */
  function parseValueFromText(
    str: string,
    version: YAMLVersion,
  ): string | number | boolean | null {
    for (const tagResolver of tagResolvers[version]) {
      if (tagResolver.testString(str)) {
        return tagResolver.resolveString(str);
      }
    }
    return str;
  }
}

/**
 * Convert QuoteDouble to YAMLDoubleQuotedScalar
 */
function convertQuoteDouble(
  preTokens: PreTokens,
  cst: CST.FlowScalar & { type: "double-quoted-scalar" },
  node: Scalar,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLDoubleQuotedScalar | YAMLWithMeta {
  const loc = ctx.getConvertLocation(...toRange(cst));
  const strValue = node.source!;
  const ast: YAMLDoubleQuotedScalar = {
    type: "YAMLScalar",
    style: "double-quoted",
    strValue,
    value: strValue,
    raw: ctx.code.slice(...loc.range),
    parent,
    ...loc,
  };
  ctx.addToken("String", loc.range);
  cst.end?.forEach((t) => processAnyToken(t, ctx));
  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);
}

/**
 * Convert QuoteSingle to YAMLSingleQuotedScalar
 */
function convertQuoteSingle(
  preTokens: PreTokens,
  cst: CST.FlowScalar & { type: "single-quoted-scalar" },
  node: Scalar,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLSingleQuotedScalar | YAMLWithMeta {
  const loc = ctx.getConvertLocation(...toRange(cst));
  const strValue = node.source!;
  const ast: YAMLSingleQuotedScalar = {
    type: "YAMLScalar",
    style: "single-quoted",
    strValue,
    value: strValue,
    raw: ctx.code.slice(...loc.range),
    parent,
    ...loc,
  };
  ctx.addToken("String", loc.range);
  cst.end?.forEach((t) => processAnyToken(t, ctx));
  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);
}

/**
 * Convert BlockLiteral to YAMLBlockLiteral
 */
function convertBlockScalar(
  preTokens: PreTokens,
  cst: CST.BlockScalar,
  node: Scalar.Parsed,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  doc: YAMLDocument,
): YAMLBlockLiteralScalar | YAMLBlockFoldedScalar | YAMLWithMeta {
  let headerToken: Token, ast: YAMLBlockFoldedScalar | YAMLBlockLiteralScalar;
  let blockStart = cst.offset;
  for (const token of cst.props) {
    if (processCommentOrSpace(token, ctx)) {
      blockStart = token.offset + token.source.length;
      continue;
    }
    if (token.type === "block-scalar-header") {
      headerToken = ctx.addToken("Punctuator", toRange(token));
      blockStart = headerToken.range[0];
      continue;
    }
    /* istanbul ignore next */
    throw ctx.throwUnexpectedTokenError(token);
  }
  const headerValue = headerToken!.value;
  const end = node.source
    ? getBlockEnd(blockStart + cst.source.length, ctx)
    : ctx.lastSkipSpaces(cst.offset, blockStart + cst.source.length);
  const loc = ctx.getConvertLocation(headerToken!.range[0], end);

  if (headerValue.startsWith(">")) {
    ast = {
      type: "YAMLScalar",
      style: "folded",
      ...parseHeader(headerValue),
      value: node.source,
      parent,
      ...loc,
    };

    const text = ctx.code.slice(blockStart, end);
    const offset = /^[^\S\n\r]*/.exec(text)![0].length;
    const tokenRange: Range = [blockStart + offset, end];
    if (tokenRange[0] < tokenRange[1]) {
      ctx.addToken("BlockFolded", tokenRange);
    }
  } else {
    ast = {
      type: "YAMLScalar",
      style: "literal",
      ...parseHeader(headerValue),
      value: node.source,
      parent,
      ...loc,
    };
    const text = ctx.code.slice(blockStart, end);
    const offset = /^[^\S\n\r]*/.exec(text)![0].length;
    const tokenRange: Range = [blockStart + offset, end];
    if (tokenRange[0] < tokenRange[1]) {
      ctx.addToken("BlockLiteral", tokenRange);
    }
  }
  return convertAnchorAndTag(preTokens, node, ctx, parent, ast, doc, ast);

  /** Get chomping kind */
  function parseHeader(header: string): {
    indent: number | null;
    chomping: "clip" | "keep" | "strip";
  } {
    const parsed = /([+-]?)(\d*)([+-]?)$/u.exec(header);
    let indent: number | null = null;
    let chomping: "clip" | "keep" | "strip" = "clip";
    if (parsed) {
      indent = parsed[2] ? Number(parsed[2]) : null;
      const chompingStr = parsed[3] || parsed[1];
      chomping =
        chompingStr === "+" ? "keep" : chompingStr === "-" ? "strip" : "clip";
    }

    return {
      chomping,
      indent,
    };
  }
}

/**
 * Get the end index from give block end
 */
function getBlockEnd(end: number, ctx: Context): number {
  let index = end;
  if (ctx.code[index - 1] === "\n" && index > 1) {
    index--;
    if (ctx.code[index - 1] === "\r" && index > 1) {
      index--;
    }
  }
  return index;
}

/**
 * Convert Alias to YAMLAlias
 */
function convertAlias(
  preTokens: PreTokens,
  cst: CST.FlowScalar & { type: "alias" },
  _node: Alias.Parsed,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
  _doc: YAMLDocument,
): YAMLAlias | YAMLWithMeta {
  const [start, end] = toRange(cst);
  const loc = ctx.getConvertLocation(start, ctx.lastSkipSpaces(start, end));
  const ast: YAMLAlias | YAMLWithMeta = {
    type: "YAMLAlias",
    name: cst.source.slice(1),
    parent,
    ...loc,
  };
  ctx.addToken("Punctuator", [loc.range[0], loc.range[0] + 1]);
  const tokenRange: Range = [loc.range[0] + 1, loc.range[1]];
  if (tokenRange[0] < tokenRange[1]) {
    ctx.addToken("Identifier", tokenRange);
  }
  const token = preTokens.first();
  /* istanbul ignore if */
  if (token) {
    throw ctx.throwUnexpectedTokenError(token);
  }

  cst.end?.forEach((t) => processAnyToken(t, ctx));

  return ast;
}

/**
 * Convert Anchor and Tag
 */
function convertAnchorAndTag<V extends NonNullable<YAMLWithMeta["value"]>>(
  preTokens: PreTokens,
  node:
    | Scalar
    | YAMLMap.Parsed
    | YAMLSeq.Parsed<ParsedNode | PairParsed>
    | Alias.Parsed
    | null,
  ctx: Context,
  parent: YAMLDocument | YAMLPair | YAMLSequence,
  value: V | null,
  doc: YAMLDocument,
  valueLoc: Locations | null,
): YAMLWithMeta | V {
  let meta: YAMLWithMeta | null = null;

  /**
   * Get YAMLWithMeta
   */
  function getMetaAst(cst: CST.SourceToken): YAMLWithMeta {
    if (meta) {
      return meta;
    }
    meta = {
      type: "YAMLWithMeta",
      anchor: null,
      tag: null,
      value,
      parent,
      ...(valueLoc
        ? {
            range: [...valueLoc.range],
            loc: cloneLoc(valueLoc.loc),
          }
        : ctx.getConvertLocation(...toRange(cst))),
    };
    if (value) {
      value.parent = meta;
    }
    return meta;
  }

  preTokens.each((cst) => {
    if (isAnchorCST(cst)) {
      const ast = getMetaAst(cst);
      const anchor = convertAnchor(cst, ctx, ast, doc);
      ast.anchor = anchor;
      adjustStartLoc(ast, anchor);
      adjustEndLoc(ast, anchor);
    } else if (isTagCST(cst)) {
      const ast = getMetaAst(cst);
      const tag = convertTag(cst, node?.tag ?? null, ctx, ast);
      ast.tag = tag;
      adjustStartLoc(ast, tag);
      adjustEndLoc(ast, tag);
    } else {
      /* istanbul ignore next */
      throw ctx.throwUnexpectedTokenError(cst);
    }
  });
  return meta || value!;
}

/**
 * Convert anchor to YAMLAnchor
 */
function convertAnchor(
  cst: CST.SourceToken & { type: "anchor" },
  ctx: Context,
  parent: YAMLWithMeta,
  doc: YAMLDocument,
): YAMLAnchor {
  const name = cst.source.slice(1);
  const loc = ctx.getConvertLocation(...toRange(cst));
  const ast: YAMLAnchor = {
    type: "YAMLAnchor",
    name,
    parent,
    ...loc,
  };

  const anchors = doc.anchors[name] || (doc.anchors[name] = []);
  anchors.push(ast);

  const punctuatorRange: Range = [loc.range[0], loc.range[0] + 1];
  ctx.addToken("Punctuator", punctuatorRange);
  const tokenRange: Range = [punctuatorRange[1], loc.range[1]];
  if (tokenRange[0] < tokenRange[1]) {
    ctx.addToken("Identifier", tokenRange);
  }
  return ast;
}

/**
 * Convert tag to YAMLTag
 */
function convertTag(
  cst: CST.SourceToken & { type: "tag" },
  tag: string | null,
  ctx: Context,
  parent: YAMLWithMeta,
): YAMLTag {
  const offset = cst.source.startsWith("!!") ? 2 : 1;
  let resolvedTag = tag ?? cst.source.slice(offset);
  if (resolvedTag === "!") {
    resolvedTag = "tag:yaml.org,2002:str";
  }
  const loc = ctx.getConvertLocation(...toRange(cst));
  const ast: YAMLTag = {
    type: "YAMLTag",
    tag: resolvedTag,
    raw: cst.source,
    parent,
    ...loc,
  };
  const punctuatorRange: Range = [loc.range[0], loc.range[0] + offset];
  ctx.addToken("Punctuator", punctuatorRange);
  const tokenRange: Range = [punctuatorRange[1], loc.range[1]];
  if (tokenRange[0] < tokenRange[1]) {
    ctx.addToken("Identifier", tokenRange);
  }
  return ast;
}

/** Checks whether the give node is scaler or null */
function isScalarOrNull(node: unknown): node is Scalar.Parsed | null {
  return isScalar(node) || node == null;
}

/** Get the pairs from the give node */
function getPairs(node: YAMLMap.Parsed | PairParsed): PairParsed[] {
  return isMap(node) ? [...node.items] : [node];
}

type CommentOrSpaceOrErrorSourceToken = CST.SourceToken & {
  type: "space" | "newline" | "flow-error-end" | "comment";
};
type NormalSourceToken = CST.SourceToken & {
  type: Exclude<
    CST.SourceToken["type"],
    CommentOrSpaceOrErrorSourceToken["type"]
  >;
};
type CommentOrSpaceOrErrorToken =
  | CommentOrSpaceOrErrorSourceToken
  | CST.ErrorToken;
type NormalToken = CST.Token & {
  type: Exclude<CST.Token["type"], CommentOrSpaceOrErrorToken["type"]>;
};

function processCommentOrSpace(
  node: CommentOrSpaceOrErrorSourceToken | NormalSourceToken,
  ctx: Context,
): node is CommentOrSpaceOrErrorSourceToken;
function processCommentOrSpace(
  node: CommentOrSpaceOrErrorToken | NormalToken,
  ctx: Context,
): node is CommentOrSpaceOrErrorToken;
/**
 * Process comments or spaces
 */
function processCommentOrSpace(node: CST.Token, ctx: Context): boolean {
  if (node.type === "space" || node.type === "newline") {
    return true;
  }
  /* istanbul ignore if */
  if (node.type === "flow-error-end" || node.type === "error") {
    throw ctx.throwUnexpectedTokenError(node);
  }
  if (node.type === "comment") {
    const comment: Comment = {
      type: "Block",
      value: node.source.slice(1),
      ...ctx.getConvertLocation(...toRange(node)),
    };
    ctx.addComment(comment);
    return true;
  }
  return false;
}

/**
 * Process any token
 */
function processAnyToken(node: CST.Token, ctx: Context): void {
  /* istanbul ignore if */
  if (!processCommentOrSpace(node, ctx)) {
    throw ctx.throwUnexpectedTokenError(node);
  }
}

/**
 * Sort tokens
 */
function sort(tokens: (Token | Comment)[]) {
  return tokens.sort((a, b) => {
    if (a.range[0] > b.range[0]) {
      return 1;
    }
    if (a.range[0] < b.range[0]) {
      return -1;
    }
    if (a.range[1] > b.range[1]) {
      return 1;
    }
    if (a.range[1] < b.range[1]) {
      return -1;
    }
    return 0;
  });
}

/**
 * clone the location.
 */
function clonePos(loc: Position): Position {
  return {
    line: loc.line,
    column: loc.column,
  };
}

/**
 * clone the location.
 */
function cloneLoc(loc: SourceLocation): SourceLocation {
  return {
    start: clonePos(loc.start),
    end: clonePos(loc.end),
  };
}

/**
 * Gets the first index with whitespace skipped.
 */
function skipSpaces(str: string, startIndex: number) {
  const len = str.length;
  for (let index = startIndex; index < len; index++) {
    if (str[index].trim()) {
      return index;
    }
  }
  return len;
}

/** SourceToken to location range */
function toRange(
  token: CST.SourceToken | CST.Directive | CST.DocumentEnd | CST.FlowScalar,
): readonly [number, number] {
  return [token.offset, token.offset + token.source.length];
}

/** Adjust start location */
function adjustStartLoc(ast: YAMLNode, first: Locations | null | undefined) {
  if (first && first.range[0] < ast.range[0]) {
    // adjust location
    ast.range[0] = first.range[0];
    ast.loc.start = clonePos(first.loc.start);
  }
}

/** Adjust end location */
function adjustEndLoc(ast: YAMLNode, last: Locations | null | undefined) {
  if (last && ast.range[1] < last.range[1]) {
    // adjust location
    ast.range[1] = last.range[1];
    ast.loc.end = clonePos(last.loc.end);
  }
}
