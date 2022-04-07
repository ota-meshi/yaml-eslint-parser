import type { SourceCode } from "eslint"
import { KEYS } from "./visitor-keys"
import { convertRoot } from "./convert"
import type { YAMLProgram } from "./ast"
import { ParseError } from "./errors"
import { Context } from "./context"
import { parseAllDocsToCST } from "./yaml-cst-parse"
/**
 * Parse source code
 */
export function parseForESLint(
    code: string,
    _options?: any,
): {
    ast: YAMLProgram
    visitorKeys: SourceCode.VisitorKeys
    services: { isYAML: boolean }
} {
    try {
        const ctx = new Context(code)

        const docs = parseAllDocsToCST(ctx)

        const ast = convertRoot(docs.cstNodes, docs.nodes, ctx)

        return {
            ast,
            visitorKeys: KEYS,
            services: {
                isYAML: true,
            },
        }
    } catch (err) {
        if (isYAMLSyntaxError(err)) {
            let message = err.message
            const atIndex = message.lastIndexOf(" at")
            if (atIndex >= 0) {
                message = message.slice(0, atIndex)
            }
            throw new ParseError(
                message,
                err.range.start,
                err.linePos.start.line,
                err.linePos.start.col - 1,
            )
        }
        if (isYAMLSyntaxErrorForV1(err)) {
            const message = err.message
            throw new ParseError(
                message,
                err.source.range.start,
                err.source.rangeAsLinePos.start.line,
                err.source.rangeAsLinePos.start.col - 1,
            )
        }

        throw err
    }
}

/**
 * Type guard for YAMLSyntaxError.
 */
function isYAMLSyntaxError(error: any): error is {
    message: string
    range: { start: number }
    linePos: { start: { line: number; col: number } }
} {
    return (
        error.linePos &&
        typeof error.linePos === "object" &&
        error.linePos.start &&
        typeof error.linePos.start === "object" &&
        typeof error.linePos.start.line === "number" &&
        typeof error.linePos.start.col === "number"
    )
}

/**
 * Type guard for YAMLSyntaxError (yaml@1.10).
 */
function isYAMLSyntaxErrorForV1(error: any): error is {
    message: string
    source: {
        range: { start: number }
        rangeAsLinePos: { start: { line: number; col: number } }
    }
} {
    return (
        error.source &&
        error.source.rangeAsLinePos &&
        typeof error.source.rangeAsLinePos === "object" &&
        error.source.rangeAsLinePos.start &&
        typeof error.source.rangeAsLinePos.start === "object" &&
        typeof error.source.rangeAsLinePos.start.line === "number" &&
        typeof error.source.rangeAsLinePos.start.col === "number"
    )
}
