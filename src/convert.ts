import yaml from "yaml"
import type {
    Root,
    Document,
    DocumentHead,
    Directive,
    DocumentBody,
    ContentNode,
    Mapping,
    MappingItem,
    MappingKey,
    MappingValue,
    Plain,
    FlowMapping,
    FlowMappingItem,
    Sequence,
    SequenceItem,
    FlowSequence,
    FlowSequenceItem,
    QuoteDouble,
    QuoteSingle,
    BlockLiteral,
    BlockFolded,
    Alias,
    Anchor,
    Tag,
    YamlUnistNode,
} from "yaml-unist-parser"
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
    YAMLWithMark,
    YAMLSequence,
} from "./ast"
import { isFalse, isTrue, isNull } from "./utils"

/**
 * Convert yaml-unist-parser root to YAMLProgram
 */
export function convertRoot(node: Root, code: string): YAMLProgram {
    const comments = node.comments.map((n) => {
        const c: Comment = {
            type: "Block",
            value: n.value,
            ...getConvertLocation(n),
        }
        return c
    })
    const stripCommentCode = comments.reduce(
        (text, comment) =>
            text.slice(0, comment.range[0]) +
            text.slice(...comment.range).replace(/\S/gu, " ") +
            text.slice(comment.range[1]),
        code,
    )
    const tokens: Token[] = []
    const ast: YAMLProgram = {
        type: "Program",
        body: [],
        comments,
        sourceType: "module",
        tokens,
        parent: null,
        ...getConvertLocation(node),
    }
    for (const n of node.children) {
        ast.body.push(convertDocument(n, tokens, stripCommentCode, ast))
    }
    const stripTokensCode = tokens.reduce(
        (text, token) =>
            text.slice(0, token.range[0]) +
            text.slice(...token.range).replace(/\S/gu, " ") +
            text.slice(token.range[1]),
        stripCommentCode,
    )
    let line = 1
    let column = 0
    for (let index = 0; index < stripTokensCode.length; index++) {
        const c = stripTokensCode[index]
        if (c === "\n") {
            line++
            column = 0
            continue
        } else if (c.trim()) {
            if (isPunctuator(c)) {
                addToken(
                    tokens,
                    "Punctuator",
                    {
                        range: [index, index + 1],
                        loc: {
                            start: {
                                line,
                                column,
                            },
                            end: {
                                line,
                                column: column + 1,
                            },
                        },
                    },
                    stripTokensCode,
                )
            }
        }

        column++
    }
    tokens.sort((a, b) => {
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
 * Convert yaml-unist-parser Document to YAMLDocument
 */
function convertDocument(
    node: Document,
    tokens: Token[],
    code: string,
    parent: YAMLProgram,
): YAMLDocument {
    const loc = getConvertLocation(node)
    const ast: YAMLDocument = {
        type: "YAMLDocument",
        directives: [],
        content: null,
        parent,
        anchors: {},
        ...loc,
    }
    ast.directives.push(
        ...convertDocumentHead(node.children[0], tokens, code, ast),
    )
    ast.content = convertDocumentBody(node.children[1], tokens, code, ast)

    // Marker
    if (code[loc.range[1] - 1] === ".") {
        const range: Range = [loc.range[1] - 3, loc.range[1]]
        addToken(
            tokens,
            "Marker",
            {
                range,
                loc: {
                    start: {
                        line: loc.loc.end.line,
                        column: loc.loc.end.column - 3,
                    },
                    end: clone(loc.loc.end),
                },
            },
            code,
        )
    }
    return ast
}

/**
 * Convert yaml-unist-parser DocumentHead to YAMLDirective[]
 */
function* convertDocumentHead(
    node: DocumentHead,
    tokens: Token[],
    code: string,
    parent: YAMLDocument,
): IterableIterator<YAMLDirective> {
    for (const n of node.children) {
        yield convertDirective(n, tokens, code, parent)
    }
    const loc = getConvertLocation(node)

    // Marker
    if (code[loc.range[1] - 1] === "-") {
        const range: Range = [loc.range[1] - 3, loc.range[1]]
        addToken(
            tokens,
            "Marker",
            {
                range,
                loc: {
                    start: {
                        line: loc.loc.end.line,
                        column: loc.loc.end.column - 3,
                    },
                    end: clone(loc.loc.end),
                },
            },
            code,
        )
    }
}

/**
 * Convert yaml-unist-parser Directive to YAMLDirective
 */
function convertDirective(
    node: Directive,
    tokens: Token[],
    code: string,
    parent: YAMLDocument,
): YAMLDirective {
    const loc = getConvertLocation(node)
    const value = code.slice(...loc.range)
    const ast: YAMLDirective = {
        type: "YAMLDirective",
        value,
        parent,
        ...loc,
    }
    addToken(tokens, "Directive", clone(loc), code)
    return ast
}

/**
 * Convert yaml-unist-parser DocumentBody to YAMLContent
 */
function convertDocumentBody(
    node: DocumentBody,
    tokens: Token[],
    code: string,
    parent: YAMLDocument,
): YAMLContent | YAMLWithMark | null {
    const contentNode = node.children[0]
    return contentNode
        ? convertContentNode(contentNode, tokens, code, parent, parent)
        : null
}

/**
 * Convert yaml-unist-parser ContentNode to YAMLContent
 */
function convertContentNode(
    node: ContentNode,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLContent | YAMLWithMark {
    if (node.type === "mapping") {
        return convertMapping(node, tokens, code, parent, doc)
    }
    if (node.type === "flowMapping") {
        return convertFlowMapping(node, tokens, code, parent, doc)
    }
    if (node.type === "sequence") {
        return convertSequence(node, tokens, code, parent, doc)
    }
    if (node.type === "flowSequence") {
        return convertFlowSequence(node, tokens, code, parent, doc)
    }
    if (node.type === "plain") {
        return convertPlain(node, tokens, code, parent, doc)
    }
    if (node.type === "quoteDouble") {
        return convertQuoteDouble(node, tokens, code, parent, doc)
    }
    if (node.type === "quoteSingle") {
        return convertQuoteSingle(node, tokens, code, parent, doc)
    }
    if (node.type === "blockLiteral") {
        return convertBlockLiteral(node, tokens, code, parent, doc)
    }
    if (node.type === "blockFolded") {
        return convertBlockFolded(node, tokens, code, parent, doc)
    }
    if (node.type === "alias") {
        return convertAlias(node, tokens, code, parent, doc)
    }
    throw new Error(`Unsupported node: ${(node as any).type}`)
}

/**
 * Convert yaml-unist-parser Mapping to YAMLBlockMapping
 */
function convertMapping(
    node: Mapping,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLSequence,
    doc: YAMLDocument,
): YAMLBlockMapping | YAMLWithMark {
    const loc = getConvertLocation(node)
    const ast: YAMLBlockMapping = {
        type: "YAMLMapping",
        style: "block",
        pairs: [],
        parent,
        ...loc,
    }
    for (const n of node.children) {
        ast.pairs.push(convertMappingItem(n, tokens, code, ast, doc))
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser FlowMapping to YAMLFlowMapping
 */
function convertFlowMapping(
    node: FlowMapping,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLFlowMapping | YAMLWithMark {
    const loc = getConvertLocation(node)
    const ast: YAMLFlowMapping = {
        type: "YAMLMapping",
        style: "flow",
        pairs: [],
        parent,
        ...loc,
    }
    for (const n of node.children) {
        ast.pairs.push(convertMappingItem(n, tokens, code, ast, doc))
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser MappingItem to YAMLPair
 */
function convertMappingItem(
    node: MappingItem | FlowMappingItem,
    tokens: Token[],
    code: string,
    parent: YAMLBlockMapping | YAMLFlowMapping,
    doc: YAMLDocument,
): YAMLPair {
    const loc = getConvertLocation(node)
    const ast: YAMLPair = {
        type: "YAMLPair",
        key: null,
        value: null,
        parent,
        ...loc,
    }
    ast.key = convertMappingKey(node.children[0], tokens, code, ast, doc)
    ast.value = convertMappingValue(node.children[1], tokens, code, ast, doc)
    return ast
}

/**
 * Convert yaml-unist-parser MappingKey to YAMLContent
 */
function convertMappingKey(
    node: MappingKey,
    tokens: Token[],
    code: string,
    parent: YAMLPair,
    doc: YAMLDocument,
): YAMLContent | YAMLWithMark | null {
    if (node.children.length) {
        return convertContentNode(node.children[0], tokens, code, parent, doc)
    }
    return null
}

/**
 * Convert yaml-unist-parser MappingValue to YAMLContent
 */
function convertMappingValue(
    node: MappingValue,
    tokens: Token[],
    code: string,
    parent: YAMLPair,
    doc: YAMLDocument,
): YAMLContent | YAMLWithMark | null {
    if (node.children.length) {
        return convertContentNode(node.children[0], tokens, code, parent, doc)
    }
    return null
}

/**
 * Convert yaml-unist-parser Sequence to YAMLBlockSequence
 */
function convertSequence(
    node: Sequence,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLBlockSequence | YAMLWithMark {
    const loc = getConvertLocation(node)
    const ast: YAMLBlockSequence = {
        type: "YAMLSequence",
        style: "block",
        entries: [],
        parent,
        ...loc,
    }
    for (const n of node.children) {
        ast.entries.push(...convertSequenceItem(n, tokens, code, ast, doc))
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser FlowSequence to YAMLBlockSequence
 */
function convertFlowSequence(
    node: FlowSequence,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLFlowSequence | YAMLWithMark {
    const loc = getConvertLocation(node)
    const ast: YAMLFlowSequence = {
        type: "YAMLSequence",
        style: "flow",
        entries: [],
        parent,
        ...loc,
    }
    for (const n of node.children) {
        if (n.type === "flowSequenceItem") {
            ast.entries.push(...convertSequenceItem(n, tokens, code, ast, doc))
        }
        if (n.type === "flowMappingItem") {
            const map: YAMLBlockMapping = {
                type: "YAMLMapping",
                style: "block",
                pairs: [],
                parent,
                ...getConvertLocation(n),
            }
            const pair = convertMappingItem(n, tokens, code, map, doc)
            map.pairs.push(pair)
            ast.entries.push(map)
        }
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser SequenceItem to YAMLContent
 */
function* convertSequenceItem(
    node: SequenceItem | FlowSequenceItem,
    tokens: Token[],
    code: string,
    parent: YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): IterableIterator<YAMLContent | YAMLWithMark> {
    if (node.children.length) {
        yield convertContentNode(node.children[0], tokens, code, parent, doc)
    }
}

/**
 * Convert yaml-unist-parser Plain to YAMLPlainScalar
 */
function convertPlain(
    node: Plain,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLPlainScalar | YAMLWithMark {
    const loc = getConvertLocation(node)
    const strValue = node.value
    let value: string | number | boolean | null

    if (isTrue(strValue)) {
        value = true
    } else if (isFalse(strValue)) {
        value = false
    } else if (isNull(strValue)) {
        value = null
    } else if (needParse(strValue)) {
        value = yaml.parse(strValue) || strValue
    } else {
        value = strValue
    }
    const ast: YAMLPlainScalar = {
        type: "YAMLScalar",
        style: "plain",
        strValue,
        value,
        parent,
        ...loc,
    }

    const type = typeof value
    if (type === "boolean") {
        addToken(tokens, "Boolean", clone(loc), code)
    } else if (type === "number" && isFinite(Number(value))) {
        addToken(tokens, "Numeric", clone(loc), code)
    } else if (value === null) {
        addToken(tokens, "Null", clone(loc), code)
    } else {
        addToken(tokens, "Identifier", clone(loc), code)
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)

    /**
     * Checks if the given string needs to be parsed
     */
    function needParse(str: string) {
        return (
            // oct
            /^0o([0-7]+)$/u.test(str) ||
            // int
            /^[-+]?[0-9]+$/u.test(str) ||
            // hex
            /^0x([0-9a-fA-F]+)$/u.test(str) ||
            // nan
            /^(?:[-+]?\.inf|(\.nan))$/iu.test(str) ||
            // exp
            /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/u.test(
                str,
            ) ||
            // float
            /^[-+]?(?:\.([0-9]+)|[0-9]+\.([0-9]*))$/u.test(str)
            // date
            // || /^\d{4}-\d{2}-\d{2}/u.test(str)
        )
    }
}

/**
 * Convert yaml-unist-parser QuoteDouble to YAMLDoubleQuotedScalar
 */
function convertQuoteDouble(
    node: QuoteDouble,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLDoubleQuotedScalar | YAMLWithMark {
    const loc = getConvertLocation(node)
    const strValue = node.value
    const ast: YAMLDoubleQuotedScalar = {
        type: "YAMLScalar",
        style: "double-quoted",
        strValue,
        value: strValue,
        raw: code.slice(...loc.range),
        parent,
        ...loc,
    }
    addToken(tokens, "String", clone(loc), code)
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser QuoteSingle to YAMLSingleQuotedScalar
 */
function convertQuoteSingle(
    node: QuoteSingle,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLSingleQuotedScalar | YAMLWithMark {
    const loc = getConvertLocation(node)
    const strValue = node.value
    const ast: YAMLSingleQuotedScalar = {
        type: "YAMLScalar",
        style: "single-quoted",
        strValue,
        value: strValue,
        raw: code.slice(...loc.range),
        parent,
        ...loc,
    }
    addToken(tokens, "String", clone(loc), code)
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser BlockLiteral to YAMLBlockLiteral
 */
function convertBlockLiteral(
    node: BlockLiteral,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLBlockLiteralScalar | YAMLWithMark {
    const loc = getConvertLocation(node)
    const value = node.value
    const ast: YAMLBlockLiteralScalar = {
        type: "YAMLScalar",
        style: "literal",
        chomping: node.chomping,
        indent: node.indent,
        value,
        parent,
        ...loc,
    }
    const text = code.slice(...loc.range)
    if (text.startsWith("|")) {
        let line = loc.loc.start.line
        let column = loc.loc.start.column + 1
        const offset = loc.range[0]
        let index = 1
        while (index < text.length) {
            const c = text[index]
            if (!c.trim()) {
                break
            }
            column++
            if (c === "\n") {
                line++
                column = 0
                break
            }
            index++
        }
        const punctuatorLoc: Locations = {
            range: [offset, offset + index],
            loc: {
                start: clone(loc.loc.start),
                end: {
                    line,
                    column,
                },
            },
        }
        addToken(tokens, "Punctuator", punctuatorLoc, code)
        while (index < text.length) {
            const c = text[index]
            if (c.trim()) {
                break
            }
            column++
            if (c === "\n") {
                line++
                column = 0
            }
            index++
        }
        const tokenLoc: Locations = {
            range: [offset + index, loc.range[1]],
            loc: {
                start: {
                    line,
                    column,
                },
                end: clone(loc.loc.end),
            },
        }
        addToken(tokens, "BlockLiteral", tokenLoc, code)
    } else {
        // ??
        addToken(tokens, "BlockLiteral", clone(loc), code)
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser BlockFolded to YAMLBlockFolded
 */
function convertBlockFolded(
    node: BlockFolded,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLBlockFoldedScalar | YAMLWithMark {
    const loc = getConvertLocation(node)
    const value = node.value
    const ast: YAMLBlockFoldedScalar = {
        type: "YAMLScalar",
        style: "folded",
        chomping: node.chomping,
        indent: node.indent,
        value,
        parent,
        ...loc,
    }
    const text = code.slice(...loc.range)
    if (text.startsWith(">")) {
        let line = loc.loc.start.line
        let column = loc.loc.start.column + 1
        const offset = loc.range[0]
        let index = 1
        while (index < text.length) {
            const c = text[index]
            if (!c.trim()) {
                break
            }
            column++
            if (c === "\n") {
                line++
                column = 0
                break
            }
            index++
        }
        const punctuatorLoc: Locations = {
            range: [offset, offset + index],
            loc: {
                start: clone(loc.loc.start),
                end: {
                    line,
                    column,
                },
            },
        }
        addToken(tokens, "Punctuator", punctuatorLoc, code)
        while (index < text.length) {
            const c = text[index]
            if (c.trim()) {
                break
            }
            column++
            if (c === "\n") {
                line++
                column = 0
            }
            index++
        }
        const tokenLoc: Locations = {
            range: [offset + index, loc.range[1]],
            loc: {
                start: {
                    line,
                    column,
                },
                end: clone(loc.loc.end),
            },
        }
        addToken(tokens, "BlockFolded", tokenLoc, code)
    } else {
        // ??
        addToken(tokens, "BlockFolded", clone(loc), code)
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser Alias to YAMLAlias
 */
function convertAlias(
    node: Alias,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLBlockSequence | YAMLFlowSequence,
    doc: YAMLDocument,
): YAMLAlias | YAMLWithMark {
    const loc = getConvertLocation(node)
    const value = node.value
    const ast: YAMLAlias = {
        type: "YAMLAlias",
        name: value,
        parent,
        ...loc,
    }
    const text = code.slice(...loc.range)
    if (text.startsWith("*")) {
        const punctuatorLoc: Locations = {
            range: [loc.range[0], loc.range[0] + 1],
            loc: {
                start: clone(loc.loc.start),
                end: {
                    line: loc.loc.start.line,
                    column: loc.loc.start.column + 1,
                },
            },
        }
        addToken(tokens, "Punctuator", punctuatorLoc, code)
        const tokenLoc: Locations = {
            range: [punctuatorLoc.range[1], loc.range[1]],
            loc: {
                start: clone(punctuatorLoc.loc.end),
                end: clone(loc.loc.end),
            },
        }
        addToken(tokens, "Identifier", tokenLoc, code)
    } else {
        // ??
        addToken(tokens, "Identifier", clone(loc), code)
    }
    return convertAnchorAndTag(node, tokens, code, parent, ast, doc)
}

/**
 * Convert yaml-unist-parser Anchor and Tag
 */
function convertAnchorAndTag<V extends YAMLContent>(
    node: ContentNode,
    tokens: Token[],
    code: string,
    parent: YAMLDocument | YAMLPair | YAMLSequence,
    value: V,
    doc: YAMLDocument,
): YAMLWithMark | V {
    if (node.anchor || node.tag) {
        const ast: YAMLWithMark = {
            type: "YAMLWithMark",
            anchor: null,
            tag: null,
            value,
            parent,
            range: clone(value.range),
            loc: clone(value.loc),
        }
        value.parent = ast

        if (node.anchor) {
            const anchor = convertAnchor(node.anchor, tokens, code, ast, doc)
            ast.anchor = anchor
            ast.range[0] = anchor.range[0]
            ast.loc.start = clone(anchor.loc.start)
        }
        if (node.tag) {
            const tag = convertTag(node.tag, tokens, code, ast)
            ast.tag = tag
            if (tag.range[0] < ast.range[0]) {
                ast.range[0] = tag.range[0]
                ast.loc.start = clone(tag.loc.start)
            }
        }
        return ast
    }

    return value
}

/**
 * Convert yaml-unist-parser Anchor to YAMLAnchor
 */
function convertAnchor(
    node: Anchor,
    tokens: Token[],
    code: string,
    parent: YAMLWithMark,
    doc: YAMLDocument,
): YAMLAnchor {
    const loc = getConvertLocation(node)
    const value = node.value
    const ast: YAMLAnchor = {
        type: "YAMLAnchor",
        name: value,
        parent,
        ...loc,
    }

    doc.anchors[value] = ast

    const text = code.slice(...loc.range)
    if (text.startsWith("&")) {
        const punctuatorLoc: Locations = {
            range: [loc.range[0], loc.range[0] + 1],
            loc: {
                start: clone(loc.loc.start),
                end: {
                    line: loc.loc.start.line,
                    column: loc.loc.start.column + 1,
                },
            },
        }
        addToken(tokens, "Punctuator", punctuatorLoc, code)
        const tokenLoc: Locations = {
            range: [punctuatorLoc.range[1], loc.range[1]],
            loc: {
                start: clone(punctuatorLoc.loc.end),
                end: clone(loc.loc.end),
            },
        }
        addToken(tokens, "Identifier", tokenLoc, code)
    } else {
        // ??
        addToken(tokens, "Identifier", clone(loc), code)
    }
    return ast
}

/**
 * Convert yaml-unist-parser Anchor to YAMLTag
 */
function convertTag(
    node: Tag,
    tokens: Token[],
    code: string,
    parent: YAMLWithMark,
): YAMLTag {
    const loc = getConvertLocation(node)
    const value = node.value
    const ast: YAMLTag = {
        type: "YAMLTag",
        tag: value,
        parent,
        ...loc,
    }
    const text = code.slice(...loc.range)
    if (text.startsWith("!")) {
        const offset = text.startsWith("!!") ? 2 : 1
        const punctuatorLoc: Locations = {
            range: [loc.range[0], loc.range[0] + offset],
            loc: {
                start: clone(loc.loc.start),
                end: {
                    line: loc.loc.start.line,
                    column: loc.loc.start.column + offset,
                },
            },
        }
        addToken(tokens, "Punctuator", punctuatorLoc, code)
        const tokenLoc: Locations = {
            range: [punctuatorLoc.range[1], loc.range[1]],
            loc: {
                start: clone(punctuatorLoc.loc.end),
                end: clone(loc.loc.end),
            },
        }
        addToken(tokens, "Identifier", tokenLoc, code)
    } else {
        // ??
        addToken(tokens, "Identifier", clone(loc), code)
    }
    return ast
}

/**
 * Get the location information of the given node.
 * @param node The node.
 */
function getConvertLocation(node: YamlUnistNode): Locations {
    const { start, end } = node.position

    return {
        range: [start.offset, end.offset],
        loc: {
            start: {
                line: start.line,
                column: start.column - 1,
            },
            end: {
                line: end.line,
                column: end.column - 1,
            },
        },
    }
}

/**
 * clone the location.
 */
function clone<T>(loc: T): T {
    if (typeof loc !== "object") {
        return loc
    }
    if (Array.isArray(loc)) {
        return loc.map(clone) as never
    }
    const n: any = {}
    // eslint-disable-next-line @mysticatea/prefer-for-of
    for (const key in loc) {
        n[key] = clone(loc[key])
    }
    return n
}

/**
 * Add token to tokens
 */
function addToken(
    tokens: Token[],
    type: Token["type"],
    loc: Locations,
    code: string,
) {
    tokens.push({
        type,
        value: code.slice(...loc.range),
        ...loc,
    })
}
