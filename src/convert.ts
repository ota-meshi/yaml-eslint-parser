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
} from "./ast"
import type {
    ASTDocument,
    CSTBlankLine,
    CSTComment,
    CSTDirective,
    CSTNode,
    ASTContentNode,
    ASTBlockMap,
    ASTPair,
    ASTFlowMap,
    ASTBlockSeq,
    ASTFlowSeq,
    ASTPlainValue,
    ASTQuoteDouble,
    ASTQuoteSingle,
    ASTBlockLiteral,
    ASTBlockFolded,
    ASTAlias,
    CSTSeqItem,
    CSTBlockFolded,
    CSTBlockLiteral,
} from "./yaml"
import { Type, PairType } from "./yaml"
import { ParseError } from "./errors"
import type { Context } from "./context"
import { tagResolvers } from "./tags"
import { getYAMLVersion } from "./utils"

const CHOMPING_MAP = {
    CLIP: "clip",
    STRIP: "strip",
    KEEP: "keep",
} as const

/**
 * Convert yaml root to YAMLProgram
 */
export function convertRoot(
    documents: ASTDocument[],
    ctx: Context,
): YAMLProgram {
    const ast: YAMLProgram = {
        type: "Program",
        body: [],
        comments: ctx.comments,
        sourceType: "module",
        tokens: ctx.tokens,
        parent: null,
        ...ctx.getConvertLocation({ range: [0, ctx.code.length] }),
    }
    let startIndex = 0
    for (const n of documents) {
        const doc = convertDocument(n, ctx, ast, startIndex)
        ast.body.push(doc)
        startIndex = doc.range[1]
    }

    const useRanges = sort([...ctx.tokens, ...ctx.comments]).map((t) => t.range)
    let range = useRanges.shift()
    for (let index = 0; index < ctx.code.length; index++) {
        while (range && range[1] <= index) {
            range = useRanges.shift()
        }
        if (range && range[0] <= index) {
            index = range[1] - 1
            continue
        }
        const c = ctx.code[index]
        if (isPunctuator(c)) {
            // console.log("*** REM TOKEN ***")
            ctx.addToken("Punctuator", [index, index + 1])
        } else if (c.trim()) {
            // console.log("*** REM TOKEN ***")
            // unknown
            ctx.addToken("Identifier", [index, index + 1])
        }
    }
    sort(ctx.comments)
    sort(ctx.tokens)
    return ast

    /**
     * Checks if the given char is punctuator
     */
    function isPunctuator(c: string) {
        return (
            c === ":" ||
            c === "-" ||
            c === "," ||
            c === "{" ||
            c === "}" ||
            c === "[" ||
            c === "]" ||
            //
            c === "?"
        )
    }
}

/**
 * Convert YAML.Document to YAMLDocument
 */
function convertDocument(
    node: ASTDocument,
    ctx: Context,
    parent: YAMLProgram,
    startIndex: number,
): YAMLDocument {
    const cst = node.cstNode!
    if (cst.error) {
        const range = cst.range || cst.valueRange!
        const loc = ctx.getLocFromIndex(range.start)
        throw new ParseError(
            cst.error.message,
            range.start,
            loc.line,
            loc.column,
        )
    }
    for (const error of node.errors) {
        throw error
    }

    const loc = ctx.getConvertLocation({
        range: [skipSpaces(ctx.code, startIndex), node.range![1]],
    })
    const ast: YAMLDocument = {
        type: "YAMLDocument",
        directives: [],
        content: null,
        parent,
        anchors: {},
        ...loc,
    }
    ast.directives.push(...convertDocumentHead(node, ctx, ast))

    // Marker
    // @ts-expect-error -- missing types?
    const directivesEndMarker = cst.directivesEndMarker
    if (directivesEndMarker) {
        const range: Range = [
            directivesEndMarker.start,
            directivesEndMarker.end,
        ]
        ctx.addToken("Marker", range)
    }

    ast.content = convertDocumentBody(node, ctx, ast)

    // Marker
    // @ts-expect-error -- missing types?
    const documentEndMarker = cst.documentEndMarker
    if (documentEndMarker) {
        const range: Range = [documentEndMarker.start, documentEndMarker.end]
        const markerToken = ctx.addToken("Marker", range)
        ast.range[1] = markerToken.range[1]
        ast.loc.end = clone(markerToken.loc.end)
    }
    return ast
}

/**
 * Convert YAML.Document.Parsed to YAMLDirective[]
 */
function* convertDocumentHead(
    node: ASTDocument,
    ctx: Context,
    parent: YAMLDocument,
): IterableIterator<YAMLDirective> {
    const cst = node.cstNode!
    for (const n of cst.directives) {
        if (processComment(n, ctx)) {
            yield convertDirective(n, ctx, parent)
        }
    }
}

/**
 * Convert CSTDirective to YAMLDirective
 */
function convertDirective(
    node: CSTDirective,
    ctx: Context,
    parent: YAMLDocument,
): YAMLDirective {
    extractComment(node, ctx)
    const loc = ctx.getConvertLocation({
        range: [
            node.range!.start,
            lastSkipSpaces(ctx.code, node.range!.start, node.valueRange!.end),
        ],
    })
    const value = ctx.code.slice(...loc.range)
    const ast: YAMLDirective = {
        type: "YAMLDirective",
        value,
        parent,
        ...loc,
    }
    ctx.addToken("Directive", loc.range)
    return ast
}

/**
 * Convert Document body to YAMLContent
 */
function convertDocumentBody(
    node: ASTDocument,
    ctx: Context,
    parent: YAMLDocument,
): YAMLContent | YAMLWithMeta | null {
    let ast: YAMLContent | YAMLWithMeta | null = null
    for (const content of node.cstNode!.contents) {
        if (processComment(content, ctx) && !ast) {
            ast = convertContentNode(
                node.contents as ASTContentNode,
                ctx,
                parent,
                parent,
            )
        }
    }
    return ast
}

/**
 * Convert ContentNode to YAMLContent
 */
function convertContentNode(
    node: ASTContentNode,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLContent | YAMLWithMeta {
    if (node.type === Type.MAP) {
        return convertMapping(node, ctx, parent, doc)
    }
    if (node.type === Type.FLOW_MAP) {
        return convertFlowMapping(node, ctx, parent, doc)
    }
    if (node.type === Type.SEQ) {
        return convertSequence(node, ctx, parent, doc)
    }
    if (node.type === Type.FLOW_SEQ) {
        return convertFlowSequence(node, ctx, parent, doc)
    }
    if (node.type === Type.PLAIN) {
        return convertPlain(node, ctx, parent, doc)
    }
    if (node.type === Type.QUOTE_DOUBLE) {
        return convertQuoteDouble(node, ctx, parent, doc)
    }
    if (node.type === Type.QUOTE_SINGLE) {
        return convertQuoteSingle(node, ctx, parent, doc)
    }
    if (node.type === Type.BLOCK_LITERAL) {
        return convertBlockLiteral(node, ctx, parent, doc)
    }
    if (node.type === Type.BLOCK_FOLDED) {
        return convertBlockFolded(node, ctx, parent, doc)
    }
    if (node.type === Type.ALIAS) {
        return convertAlias(node, ctx, parent, doc)
    }
    throw new Error(`Unsupported node: ${(node as any).type}`)
}

/**
 * Convert Map to YAMLBlockMapping
 */
function convertMapping(
    node: ASTBlockMap,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLSequence,
    doc: YAMLDocument,
): YAMLBlockMapping | YAMLWithMeta {
    const loc = ctx.getConvertLocationFromCSTRange(node.cstNode!.valueRange)
    const ast: YAMLBlockMapping = {
        type: "YAMLMapping",
        style: "block",
        pairs: [],
        parent,
        ...loc,
    }
    const cstPairRanges = processCSTItems(node, ctx)
    node.items.forEach((n, index) => {
        ast.pairs.push(
            convertMappingItem(n, cstPairRanges[index], ctx, ast, doc),
        )
    })
    const first = ast.pairs[0]
    if (first && ast.range[0] !== first.range[0]) {
        // adjust location
        ast.range[0] = first.range[0]
        ast.loc.start = clone(first.loc.start)
    }
    const last = ast.pairs[ast.pairs.length - 1]
    if (last && ast.range[1] !== last.range[1]) {
        // adjust location
        ast.range[1] = last.range[1]
        ast.loc.end = clone(last.loc.end)
    }
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert FlowMap to YAMLFlowMapping
 */
function convertFlowMapping(
    node: ASTFlowMap,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLFlowMapping | YAMLWithMeta {
    const loc = ctx.getConvertLocationFromCSTRange(node.cstNode!.valueRange)
    const ast: YAMLFlowMapping = {
        type: "YAMLMapping",
        style: "flow",
        pairs: [],
        parent,
        ...loc,
    }
    const cstPairRanges = processCSTItems(node, ctx)
    node.items.forEach((n, index) => {
        ast.pairs.push(
            convertMappingItem(n, cstPairRanges[index], ctx, ast, doc),
        )
    })
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert Pair to YAMLPair
 */
function convertMappingItem(
    node: ASTPair,
    cstPairRanges: CSTPairRanges,
    ctx: Context,
    parent: YAMLBlockMapping | YAMLFlowMapping,
    doc: YAMLDocument,
): YAMLPair {
    const loc = ctx.getConvertLocation({ range: cstPairRanges.range })
    const ast: YAMLPair = {
        type: "YAMLPair",
        key: null,
        value: null,
        parent,
        ...loc,
    }
    ast.key = convertMappingKey(node.key, ctx, ast, doc)
    ast.value = convertMappingValue(node.value, ctx, ast, doc)
    if (ast.value) {
        if (ast.range[1] !== ast.value.range[1]) {
            // adjust location
            ast.range[1] = ast.value.range[1]
            ast.loc.end = clone(ast.value.loc.end)
        }
    } else if (ast.key) {
        if (cstPairRanges.value == null && ast.range[1] !== ast.key.range[1]) {
            // adjust location
            ast.range[1] = ast.key.range[1]
            ast.loc.end = clone(ast.key.loc.end)
        }
    }
    if (ast.key) {
        if (ast.key.range[0] < ast.range[0]) {
            // adjust location
            ast.range[0] = ast.key.range[0]
            ast.loc.start = clone(ast.key.loc.start)
        }
    }
    return ast
}

/**
 * Convert MapKey to YAMLContent
 */
function convertMappingKey(
    node: ASTContentNode | null,
    ctx: Context,
    parent: YAMLPair,
    doc: YAMLDocument,
): YAMLContent | YAMLWithMeta | null {
    if (node && node.type) {
        return convertContentNode(node, ctx, parent, doc)
    }
    return null
}

/**
 * Convert MapValue to YAMLContent
 */
function convertMappingValue(
    node: ASTContentNode | null,
    ctx: Context,
    parent: YAMLPair,
    doc: YAMLDocument,
): YAMLContent | YAMLWithMeta | null {
    if (node) {
        return convertContentNode(node, ctx, parent, doc)
    }
    return null
}

/**
 * Convert BlockSeq to YAMLBlockSequence
 */
function convertSequence(
    node: ASTBlockSeq,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLBlockSequence | YAMLWithMeta {
    const loc = ctx.getConvertLocationFromCSTRange(node.cstNode!.valueRange)
    const ast: YAMLBlockSequence = {
        type: "YAMLSequence",
        style: "block",
        entries: [],
        parent,
        ...loc,
    }
    const cstSeqItems: CSTSeqItem[] = []
    for (const n of node.cstNode!.items) {
        if (n.type === Type.SEQ_ITEM) {
            ctx.addToken("Punctuator", [n.range!.start, n.range!.start + 1])
            extractComment(n, ctx)
            cstSeqItems.push(n)
            continue
        }
        processComment(n, ctx)
    }
    node.items.forEach((n, index) => {
        ast.entries.push(
            ...convertSequenceItem(
                n as ASTContentNode | ASTPair | null,
                cstSeqItems[index],
                ctx,
                ast,
                doc,
            ),
        )
    })
    const last = ast.entries[ast.entries.length - 1]
    if (last && ast.range[1] !== last.range[1]) {
        // adjust location
        ast.range[1] = last.range[1]
        ast.loc.end = clone(last.loc.end)
    }
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert FlowSeq to YAMLFlowSequence
 */
function convertFlowSequence(
    node: ASTFlowSeq,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLFlowSequence | YAMLWithMeta {
    const loc = ctx.getConvertLocationFromCSTRange(node.cstNode!.valueRange)
    const ast: YAMLFlowSequence = {
        type: "YAMLSequence",
        style: "flow",
        entries: [],
        parent,
        ...loc,
    }

    const cstPairRanges = processCSTItems(node, ctx)
    node.items.forEach((n, index) => {
        if (n.type === PairType.PAIR || n.type === PairType.MERGE_PAIR) {
            const p = n as ASTPair
            const cstPairRange = cstPairRanges[index]
            const map: YAMLBlockMapping = {
                type: "YAMLMapping",
                style: "block",
                pairs: [],
                parent,
                ...ctx.getConvertLocation({ range: cstPairRange.range }),
            }
            const pair = convertMappingItem(p, cstPairRange, ctx, map, doc)
            map.pairs.push(pair)
            if (pair && map.range[1] !== pair.range[1]) {
                // adjust location
                map.range[1] = pair.range[1]
                map.loc.end = clone(pair.loc.end)
            }
            ast.entries.push(map)
        } else {
            ast.entries.push(
                ...convertFlowSequenceItem(
                    n as ASTContentNode | null,
                    ctx,
                    ast,
                    doc,
                ),
            )
        }
    })
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert SeqItem to YAMLContent
 */
function* convertSequenceItem(
    node: ASTContentNode | ASTPair | null,
    cst: CSTSeqItem,
    ctx: Context,
    parent: YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): IterableIterator<YAMLContent | YAMLWithMeta | null> {
    if (node) {
        if (node.type === PairType.PAIR || node.type === PairType.MERGE_PAIR) {
            const cstRange = cst.node!.range!
            const range: Range = [cstRange.start, cstRange.end]
            const map: YAMLBlockMapping = {
                type: "YAMLMapping",
                style: "block",
                pairs: [],
                parent,
                ...ctx.getConvertLocation({ range }),
            }
            // TODO collect : token
            const pair = convertMappingItem(
                node,
                { range } as CSTPairRanges,
                ctx,
                map,
                doc,
            )
            map.pairs.push(pair)
            if (pair && map.range[1] !== pair.range[1]) {
                // adjust location
                map.range[1] = pair.range[1]
                map.loc.end = clone(pair.loc.end)
            }
            yield map
        } else {
            yield convertContentNode(node as ASTContentNode, ctx, parent, doc)
        }
    } else {
        yield null
    }
}

/**
 * Convert FlowSeqItem to YAMLContent
 */
function* convertFlowSequenceItem(
    node: ASTContentNode | null,
    ctx: Context,
    parent: YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): IterableIterator<YAMLContent | YAMLWithMeta> {
    if (node) {
        yield convertContentNode(node, ctx, parent, doc)
    }
}

/**
 * Convert PlainValue to YAMLPlainScalar
 */
function convertPlain(
    node: ASTPlainValue,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLPlainScalar | YAMLWithMeta {
    const valueRange = node.cstNode!.valueRange!

    const loc = ctx.getConvertLocation({
        range: [
            valueRange.start,
            lastSkipSpaces(ctx.code, valueRange.start, valueRange.end),
        ],
    })
    if (loc.range[0] < loc.range[1]) {
        const strValue = node.cstNode!.strValue!
        const value = parseValueFromText(strValue, getYAMLVersion(doc))

        const ast: YAMLPlainScalar = {
            type: "YAMLScalar",
            style: "plain",
            strValue,
            value,
            raw: ctx.code.slice(...loc.range),
            parent,
            ...loc,
        }

        const type = typeof value
        if (type === "boolean") {
            ctx.addToken("Boolean", loc.range)
        } else if (type === "number" && isFinite(Number(value))) {
            ctx.addToken("Numeric", loc.range)
        } else if (value === null) {
            ctx.addToken("Null", loc.range)
        } else {
            ctx.addToken("Identifier", loc.range)
        }
        return convertAnchorAndTag(node, ctx, parent, ast, doc, loc)
    }

    return convertAnchorAndTag<YAMLPlainScalar>(
        node,
        ctx,
        parent,
        null,
        doc,
        loc,
    )

    /**
     * Parse value from text
     */
    function parseValueFromText(
        str: string,
        version: "1.2" | "1.1",
    ): string | number | boolean | null {
        for (const tagResolver of tagResolvers[version]) {
            if (tagResolver.test(str)) {
                return tagResolver.resolve(str)
            }
        }
        return str
    }
}

/**
 * Convert QuoteDouble to YAMLDoubleQuotedScalar
 */
function convertQuoteDouble(
    node: ASTQuoteDouble,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLDoubleQuotedScalar | YAMLWithMeta {
    const loc = ctx.getConvertLocationFromCSTRange(node.cstNode!.valueRange)

    const cst = node.cstNode!
    const strValue =
        typeof cst.strValue === "object" && cst.strValue
            ? cst.strValue.str
            : cst.strValue || ""
    const ast: YAMLDoubleQuotedScalar = {
        type: "YAMLScalar",
        style: "double-quoted",
        strValue,
        value: strValue,
        raw: ctx.code.slice(...loc.range),
        parent,
        ...loc,
    }
    ctx.addToken("String", loc.range)
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert QuoteSingle to YAMLSingleQuotedScalar
 */
function convertQuoteSingle(
    node: ASTQuoteSingle,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLSingleQuotedScalar | YAMLWithMeta {
    const loc = ctx.getConvertLocationFromCSTRange(node.cstNode!.valueRange)
    const cst = node.cstNode!
    const strValue =
        typeof cst.strValue === "object" && cst.strValue
            ? cst.strValue.str
            : cst.strValue || ""
    const ast: YAMLSingleQuotedScalar = {
        type: "YAMLScalar",
        style: "single-quoted",
        strValue,
        value: strValue,
        raw: ctx.code.slice(...loc.range),
        parent,
        ...loc,
    }
    ctx.addToken("String", loc.range)
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert BlockLiteral to YAMLBlockLiteral
 */
function convertBlockLiteral(
    node: ASTBlockLiteral,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLBlockLiteralScalar | YAMLWithMeta {
    const cst = node.cstNode!
    const end = getBlockEnd(cst, ctx)
    const loc = ctx.getConvertLocation({
        range: [cst.header.start, end],
    })
    const value = cst.strValue || ""

    const ast: YAMLBlockLiteralScalar = {
        type: "YAMLScalar",
        style: "literal",
        chomping: CHOMPING_MAP[cst.chomping],
        indent: getBlockIndent(node),
        value,
        parent,
        ...loc,
    }
    const punctuatorRange: Range = [cst.header.start, cst.header.end]
    ctx.addToken("Punctuator", punctuatorRange)
    const text = ctx.code.slice(cst.valueRange!.start, end)
    const offset = /^[^\S\n\r]*/.exec(text)![0].length
    const tokenRange: Range = [cst.valueRange!.start + offset, end]
    if (tokenRange[0] < tokenRange[1]) {
        ctx.addToken("BlockLiteral", tokenRange)
    }
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert BlockFolded to YAMLBlockFolded
 */
function convertBlockFolded(
    node: ASTBlockFolded,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLBlockFoldedScalar | YAMLWithMeta {
    const cst = node.cstNode!
    const end = getBlockEnd(cst, ctx)
    const loc = ctx.getConvertLocation({
        range: [cst.header.start, end],
    })
    const value = cst.strValue || ""
    const ast: YAMLBlockFoldedScalar = {
        type: "YAMLScalar",
        style: "folded",
        chomping: CHOMPING_MAP[cst.chomping],
        indent: getBlockIndent(node),
        value,
        parent,
        ...loc,
    }
    const punctuatorRange: Range = [cst.header.start, cst.header.end]
    ctx.addToken("Punctuator", punctuatorRange)

    const text = ctx.code.slice(cst.valueRange!.start, end)
    const offset = /^[^\S\n\r]*/.exec(text)![0].length
    const tokenRange: Range = [cst.valueRange!.start + offset, end]
    if (tokenRange[0] < tokenRange[1]) {
        ctx.addToken("BlockFolded", tokenRange)
    }
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Get the end index from give block node
 */
function getBlockEnd(
    cst: CSTBlockFolded | CSTBlockLiteral,
    ctx: Context,
): number {
    let index = cst.valueRange!.end
    if (ctx.code[index - 1] === "\n" && index > 1) {
        index--
        if (ctx.code[index - 1] === "\r" && index > 1) {
            index--
        }
    }
    return index
}

/**
 * Get block indent from given block
 */
function getBlockIndent(node: ASTBlockLiteral | ASTBlockFolded) {
    const cst = node.cstNode!
    const numLength = cst.header.end - cst.header.start - 1
    return numLength - (cst.chomping === "CLIP" ? 0 : 1)
        ? cst.blockIndent
        : null
}

/**
 * Convert Alias to YAMLAlias
 */
function convertAlias(
    node: ASTAlias,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLAlias | YAMLWithMeta {
    const cst = node.cstNode!
    const range = cst.range!
    const valueRange = cst.valueRange!
    const nodeRange: Range = [range.start, valueRange.end]

    if (range.start === valueRange.start) {
        // adjust
        nodeRange[0]--
    }
    const loc = ctx.getConvertLocation({
        range: nodeRange,
    })
    const ast: YAMLAlias = {
        type: "YAMLAlias",
        name: cst.rawValue,
        parent,
        ...loc,
    }
    const starIndex = nodeRange[0]
    ctx.addToken("Punctuator", [starIndex, starIndex + 1])
    const tokenRange: Range = [valueRange.start, valueRange.end]
    if (tokenRange[0] < tokenRange[1]) {
        ctx.addToken("Identifier", tokenRange)
    }
    return convertAnchorAndTag(node, ctx, parent, ast, doc, ast)
}

/**
 * Convert Anchor and Tag
 */
function convertAnchorAndTag<V extends YAMLContent>(
    node: ASTContentNode,
    ctx: Context,
    parent: YAMLDocument | YAMLPair | YAMLSequence,
    value: V | null,
    doc: YAMLDocument,
    valueLoc: Locations,
): YAMLWithMeta | V {
    const cst = node.cstNode!
    let meta: YAMLWithMeta | null = null

    /**
     * Get YAMLWithMeta
     */
    function getMetaAst(): YAMLWithMeta {
        if (meta) {
            return meta
        }
        meta = {
            type: "YAMLWithMeta",
            anchor: null,
            tag: null,
            value,
            parent,
            range: clone(valueLoc.range),
            loc: clone(valueLoc.loc),
        }
        if (value) {
            value.parent = meta
        }
        return meta
    }

    for (const range of cst.props) {
        const startChar = ctx.code[range.start]
        if (startChar === "&") {
            const ast = getMetaAst()
            const anchor = convertAnchor(
                [range.start, range.end],
                cst.anchor!,
                ctx,
                ast,
                doc,
            )
            ast.anchor = anchor
            if (anchor.range[0] < ast.range[0]) {
                ast.range[0] = anchor.range[0]
                ast.loc.start = clone(anchor.loc.start)
            }
        } else if (startChar === "!") {
            const ast = getMetaAst()
            const tag = convertTag(
                [range.start, range.end],
                node.tag!,
                ctx,
                ast,
            )
            ast.tag = tag
            if (tag.range[0] < ast.range[0]) {
                ast.range[0] = tag.range[0]
                ast.loc.start = clone(tag.loc.start)
            }
        } else if (startChar === "#") {
            const comment: Comment = {
                type: "Block",
                value: ctx.code.slice(range.start + 1, range.end),
                ...ctx.getConvertLocationFromCSTRange(range),
            }
            ctx.addComment(comment)
        }
    }
    return meta || (value as never)
}

/**
 * Convert anchor to YAMLAnchor
 */
function convertAnchor(
    range: Range,
    name: string,
    ctx: Context,
    parent: YAMLWithMeta,
    doc: YAMLDocument,
): YAMLAnchor {
    const loc = ctx.getConvertLocation({ range })
    const ast: YAMLAnchor = {
        type: "YAMLAnchor",
        name,
        parent,
        ...loc,
    }

    const anchors = doc.anchors[name] || (doc.anchors[name] = [])
    anchors.push(ast)

    const punctuatorRange: Range = [loc.range[0], loc.range[0] + 1]
    ctx.addToken("Punctuator", punctuatorRange)
    const tokenRange: Range = [punctuatorRange[1], loc.range[1]]
    if (tokenRange[0] < tokenRange[1]) {
        ctx.addToken("Identifier", tokenRange)
    }
    return ast
}

/**
 * Convert tag to YAMLTag
 */
function convertTag(
    range: Range,
    tag: string,
    ctx: Context,
    parent: YAMLWithMeta,
): YAMLTag {
    const loc = ctx.getConvertLocation({ range })
    const ast: YAMLTag = {
        type: "YAMLTag",
        tag,
        parent,
        ...loc,
    }
    const text = ctx.code.slice(...loc.range)
    const offset = text.startsWith("!!") ? 2 : 1
    const punctuatorRange: Range = [loc.range[0], loc.range[0] + offset]
    ctx.addToken("Punctuator", punctuatorRange)
    const tokenRange: Range = [punctuatorRange[1], loc.range[1]]
    if (tokenRange[0] < tokenRange[1]) {
        ctx.addToken("Identifier", tokenRange)
    }
    return ast
}

/**
 * Process comments
 */
function processComment<N extends CSTNode>(
    node: CSTBlankLine | CSTComment | N,
    ctx: Context,
): node is N {
    if (node.type === Type.BLANK_LINE) {
        return false
    }
    if (node.type === Type.COMMENT) {
        const comment: Comment = {
            type: "Block",
            value: node.comment,
            ...ctx.getConvertLocationFromCSTRange(node.range),
        }
        ctx.addComment(comment)
        return false
    }
    return true
}

/**
 * Extract comments from props
 */
function extractComment(cst: CSTNode, ctx: Context): void {
    for (const range of cst.props) {
        const startChar = ctx.code[range.start]
        if (startChar === "#") {
            const comment: Comment = {
                type: "Block",
                value: ctx.code.slice(range.start + 1, range.end),
                ...ctx.getConvertLocationFromCSTRange(range),
            }
            ctx.addComment(comment)
        }
    }
}

type CSTPairRanges =
    | {
          key: Range
          value: Range
          range: Range
      }
    | {
          key: null
          value: Range
          range: Range
      }
    | {
          key: Range
          value: null
          range: Range
      }

/**
 * Process CST items
 */
function processCSTItems(
    node: ASTBlockMap | ASTFlowMap | ASTFlowSeq,
    ctx: Context,
): CSTPairRanges[] {
    const parsed = [...parseCSTItems(node.cstNode!.items)]

    return parsed

    type CSTItem = Required<
        ASTBlockMap | ASTFlowMap | ASTFlowSeq
    >["cstNode"]["items"][number]
    type CSTPairItem = Exclude<CSTItem, CSTBlankLine | CSTComment>

    /* eslint-disable complexity -- ignore */
    /**
     * Parse for cst items
     */
    function* parseCSTItems(
        /* eslint-enable complexity -- ignore */
        items: CSTItem[],
    ): IterableIterator<CSTPairRanges> {
        // eslint-disable-next-line no-shadow -- bug?
        const enum PairDataState {
            empty,
            // ?
            keyMark,
            // KEY
            // ? KEY
            key,
            // KEY :
            // ? KEY :
            // ? :
            // :
            valueMark,
        }
        let data: {
            key: CSTPairItem[]
            value: CSTPairItem[]
            state: PairDataState
        } = {
            key: [],
            value: [],
            state: PairDataState.empty,
        }

        for (const cstItem of items) {
            if ("char" in cstItem) {
                ctx.addToken("Punctuator", [cstItem.offset, cstItem.offset + 1])
                if (
                    cstItem.char === "[" ||
                    cstItem.char === "]" ||
                    cstItem.char === "{" ||
                    cstItem.char === "}"
                ) {
                    continue
                }
                if (cstItem.char === ",") {
                    if (data.state !== PairDataState.empty) {
                        yield parseGroup(data)
                    }
                    data = { key: [], value: [], state: PairDataState.empty }
                    continue
                }
                if (cstItem.char === "?") {
                    if (data.state !== PairDataState.empty) {
                        yield parseGroup(data)
                        data = {
                            key: [cstItem],
                            value: [],
                            state: PairDataState.keyMark,
                        }
                    } else {
                        data.key.push(cstItem)
                        data.state = PairDataState.keyMark
                    }
                    continue
                } else if (cstItem.char === ":") {
                    if (
                        data.state === PairDataState.empty ||
                        data.state === PairDataState.keyMark ||
                        data.state === PairDataState.key
                    ) {
                        data.value.push(cstItem)
                        data.state = PairDataState.valueMark
                    } else {
                        yield parseGroup(data)
                        data = {
                            key: [],
                            value: [cstItem],
                            state: PairDataState.valueMark,
                        }
                    }
                    continue
                }
            } else if (!processComment(cstItem, ctx)) {
                continue
            } else {
                if (cstItem.type === Type.MAP_VALUE) {
                    ctx.addToken("Punctuator", [
                        cstItem.range!.start,
                        cstItem.range!.start + 1,
                    ])
                    extractComment(cstItem, ctx)
                    if (
                        data.state === PairDataState.empty ||
                        data.state === PairDataState.keyMark ||
                        data.state === PairDataState.key
                    ) {
                        data.value.push(cstItem)
                        yield parseGroup(data)
                    } else {
                        yield parseGroup(data)
                        yield parseGroup({ key: [], value: [cstItem] })
                    }
                    data = { key: [], value: [], state: PairDataState.empty }
                    continue
                } else if (cstItem.type === Type.MAP_KEY) {
                    ctx.addToken("Punctuator", [
                        cstItem.range!.start,
                        cstItem.range!.start + 1,
                    ])
                    extractComment(cstItem, ctx)
                    if (data.state !== PairDataState.empty) {
                        yield parseGroup(data)
                        data = {
                            key: [cstItem],
                            value: [],
                            state: PairDataState.key,
                        }
                    } else {
                        data.key.push(cstItem)
                        data.state = PairDataState.key
                    }
                    continue
                } else {
                    if (
                        data.state === PairDataState.empty ||
                        data.state === PairDataState.keyMark
                    ) {
                        data.key.push(cstItem)
                        data.state = PairDataState.key
                        continue
                    }
                    if (data.state === PairDataState.key) {
                        yield parseGroup(data)
                        data = {
                            key: [cstItem],
                            value: [],
                            state: PairDataState.key,
                        }
                        continue
                    }
                    if (data.state === PairDataState.valueMark) {
                        data.value.push(cstItem)
                        yield parseGroup(data)
                        data = {
                            key: [],
                            value: [],
                            state: PairDataState.empty,
                        }
                        continue
                    }
                }
            }
        }
        if (data.state !== PairDataState.empty) {
            yield parseGroup(data)
        }
    }

    /**
     * Parse for cst item group
     */
    function parseGroup(data: {
        key: CSTPairItem[]
        value: CSTPairItem[]
    }): CSTPairRanges {
        if (data.key.length && data.value.length) {
            const key = itemsToRange(data.key)
            const value = itemsToRange(data.value)
            return {
                key,
                value,
                range: [key[0], value[1]],
            }
        }
        if (data.key.length) {
            const key = itemsToRange(data.key)
            return {
                key,
                value: null,
                range: key,
            }
        }
        if (data.value.length) {
            const value = itemsToRange(data.value)
            return {
                key: null,
                value,
                range: value,
            }
        }
        throw new Error("Unexpected state")
    }

    /** get range */
    function itemsToRange(items: CSTPairItem[]): Range {
        const first = itemToRange(items[0])
        if (items.length === 1) {
            return first
        }
        const last = itemToRange(items[items.length - 1])
        return [first[0], last[1]]
    }

    /** get range */
    function itemToRange(item: CSTPairItem): Range {
        if ("char" in item) {
            return [item.offset, item.offset + 1]
        }
        const range = item.range || item.valueRange!
        return [range.start, range.end]
    }
}

/**
 * Sort tokens
 */
function sort(tokens: (Token | Comment)[]) {
    return tokens.sort((a, b) => {
        if (a.range[0] > b.range[0]) {
            return 1
        }
        if (a.range[0] < b.range[0]) {
            return -1
        }
        if (a.range[1] > b.range[1]) {
            return 1
        }
        if (a.range[1] < b.range[1]) {
            return -1
        }
        return 0
    })
}

/**
 * clone the location.
 */
function clone<T>(loc: T): T {
    if (typeof loc !== "object") {
        return loc
    }
    if (Array.isArray(loc)) {
        return (loc as any).map(clone)
    }
    const n: any = {}
    for (const key in loc) {
        n[key] = clone(loc[key])
    }
    return n
}

/**
 * Gets the first index with whitespace skipped.
 */
function skipSpaces(str: string, startIndex: number) {
    const len = str.length
    for (let index = startIndex; index < len; index++) {
        if (str[index].trim()) {
            return index
        }
    }
    return len
}

/**
 * Gets the last index with whitespace skipped.
 */
function lastSkipSpaces(str: string, startIndex: number, endIndex: number) {
    for (let index = endIndex - 1; index >= startIndex; index--) {
        if (str[index].trim()) {
            return index + 1
        }
    }
    return startIndex
}
