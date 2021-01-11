import type { CST, AST } from "yaml"
import type YAML from "yaml"
import type { Alias } from "yaml/types"
import { Pair } from "yaml/types"
export { Type } from "yaml/util"
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const PairType = Pair.Type

export type CSTDirective = CST.Directive
export type CSTDocument = CST.Document
export type CSTAlias = CST.Alias
export type CSTBlockValue = CST.BlockValue
export type CSTPlainValue = CST.PlainValue
export type CSTQuoteValue = CST.QuoteValue
export type CSTMap = CST.Map
export type CSTSeq = CST.Seq
export type CSTFlowMap = CST.FlowMap
export type CSTFlowSeq = CST.FlowSeq
export type CSTMapKey = CST.MapKey
export type CSTMapValue = CST.MapValue
export type CSTSeqItem = CST.SeqItem

export type CSTNode =
    | CSTDirective
    | CSTDocument
    | CSTContentNode
    | CSTMapItem
    | CSTSeqItem

export type CSTMapItem = CSTMapKey | CSTMapValue

export type CSTContentNode =
    | CSTAlias
    | CSTScalar
    | CSTMap
    | CSTSeq
    | CSTFlowMap
    | CSTFlowSeq
export type CSTScalar = CSTBlockValue | CSTPlainValue | CSTQuoteValue

export type CSTBlankLine = CST.BlankLine
export type CSTComment = CST.Comment
export type CSTFlowChar = CST.FlowChar
export type CSTRange = CST.Range

export type ASTNode = ASTDocument | ASTContentNode
export type ASTDocument = YAML.Document.Parsed
export type ASTContentNode =
    | ASTBlockMap
    | ASTFlowMap
    | ASTBlockSeq
    | ASTFlowSeq
    | ASTPlainValue
    | ASTQuoteDouble
    | ASTQuoteSingle
    | ASTBlockLiteral
    | ASTBlockFolded
    | ASTAlias
export type ASTBlockMap = AST.BlockMap
export type ASTFlowMap = AST.FlowMap
export type ASTBlockSeq = AST.BlockSeq
export type ASTFlowSeq = AST.FlowSeq
export type ASTPlainValue = AST.PlainValue
export type ASTQuoteDouble = AST.QuoteDouble
export type ASTQuoteSingle = AST.QuoteSingle
export type ASTBlockLiteral = AST.BlockLiteral
export type ASTBlockFolded = AST.BlockFolded
export type ASTAlias = Alias

export type ASTPair = Pair
