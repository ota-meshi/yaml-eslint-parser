export type Range = [number, number]

export interface Locations {
    loc: SourceLocation
    range: Range
}

interface BaseYAMLNode extends Locations {
    type: string
}

interface SourceLocation {
    start: Position
    end: Position
}

export interface Token extends BaseYAMLNode {
    type:
        | "Directive"
        | "Marker"
        | "Punctuator"
        | "Identifier"
        | "String"
        | "Boolean"
        | "Numeric"
        | "Null"
        | "BlockLiteral"
        | "BlockFolded"
    value: string
}

export interface Comment extends BaseYAMLNode {
    type: "Line" | "Block"
    value: string
}

export interface Position {
    /** >= 1 */
    line: number
    /** >= 0 */
    column: number
}

export type YAMLNode =
    | YAMLProgram
    | YAMLDocument
    | YAMLDirective
    | YAMLContent
    | YAMLPair
    | YAMLAnchor
    | YAMLTag
export interface YAMLProgram extends BaseYAMLNode {
    type: "Program"
    body: YAMLDocument[]
    sourceType: "module"
    comments: Comment[]
    tokens: Token[]
    parent: null
}

export interface YAMLDocument extends BaseYAMLNode {
    type: "YAMLDocument"
    directives: YAMLDirective[]
    content: YAMLContent | null
    parent: YAMLProgram
    anchors: { [key: string]: YAMLAnchor }
}

export interface YAMLDirective extends BaseYAMLNode {
    type: "YAMLDirective"
    value: string
    parent: YAMLDocument
}

export interface YAMLAnchor extends BaseYAMLNode {
    type: "YAMLAnchor"
    name: string
    parent: YAMLContent
}

export interface YAMLTag extends BaseYAMLNode {
    type: "YAMLTag"
    tag: string
    parent: YAMLContent
}

interface BaseYAMLContentNode extends BaseYAMLNode {
    anchor: null | YAMLAnchor
    tag: null | YAMLTag
    parent: YAMLDocument | YAMLPair | YAMLSequence | YAMLFlowSequence
}

export type YAMLContent =
    | YAMLMapping
    | YAMLFlowMapping
    | YAMLSequence
    | YAMLFlowSequence
    | YAMLPlain
    | YAMLDoubleQuoted
    | YAMLSingleQuoted
    | YAMLBlockLiteral
    | YAMLBlockFolded
    | YAMLAlias

export interface YAMLMapping extends BaseYAMLContentNode {
    type: "YAMLMapping"
    pairs: YAMLPair[]
}

export interface YAMLFlowMapping extends BaseYAMLContentNode {
    type: "YAMLFlowMapping"
    pairs: YAMLPair[]
}

export interface YAMLPair extends BaseYAMLNode {
    type: "YAMLPair"
    key: YAMLContent | null
    value: YAMLContent | null
    parent: YAMLMapping | YAMLFlowMapping | YAMLFlowSequence
}

export interface YAMLSequence extends BaseYAMLContentNode {
    type: "YAMLSequence"
    entries: YAMLContent[]
}

export interface YAMLFlowSequence extends BaseYAMLContentNode {
    type: "YAMLFlowSequence"
    entries: (YAMLContent | YAMLPair)[]
}

export interface YAMLPlain extends BaseYAMLContentNode {
    type: "YAMLPlain"
    strValue: string
    readonly value: string | number | boolean | null
}

export interface YAMLDoubleQuoted extends BaseYAMLContentNode {
    type: "YAMLDoubleQuoted"
    strValue: string
    readonly value: string | number | boolean | null
}

export interface YAMLSingleQuoted extends BaseYAMLContentNode {
    type: "YAMLSingleQuoted"
    strValue: string
    readonly value: string | number | boolean | null
}

export interface YAMLBlockLiteral extends BaseYAMLContentNode {
    type: "YAMLBlockLiteral"
    chomping: "clip" | "keep" | "strip"
    indent: null | number
    value: string
}

export interface YAMLBlockFolded extends BaseYAMLContentNode {
    type: "YAMLBlockFolded"
    chomping: "clip" | "keep" | "strip"
    indent: null | number
    value: string
}

export interface YAMLAlias extends BaseYAMLContentNode {
    type: "YAMLAlias"
    name: string
}
