import type { YAMLSyntaxError } from "yaml-unist-parser"
import { parse as parseYaml } from "yaml-unist-parser"
import type { SourceCode } from "eslint"
import { KEYS } from "./visitor-keys"
import { convertRoot } from "./convert"
import type { YAMLProgram } from "./ast"
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
        const rootNode = parseYaml(code)
        const ast = convertRoot(rootNode, code)

        return {
            ast,
            visitorKeys: KEYS,
            services: {
                isYAML: true,
            },
        }
    } catch (err) {
        if (isYAMLSyntaxError(err)) {
            throw new ParseError(
                err.message,
                err.position.start.offset,
                err.position.start.line,
                err.position.start.column - 1,
            )
        }
        throw err
    }
}

/**
 * Type guard for YAMLSyntaxError.
 */
function isYAMLSyntaxError(error: any): error is YAMLSyntaxError {
    return (
        typeof error.position === "object" &&
        typeof error.position.start === "object" &&
        typeof error.position.end === "object" &&
        typeof error.position.start.line === "number" &&
        typeof error.position.start.column === "number" &&
        typeof error.position.start.offset === "number" &&
        typeof error.position.end.line === "number" &&
        typeof error.position.end.column === "number" &&
        typeof error.position.end.offset === "number"
    )
}

/**
 * YAML parse errors.
 */
export class ParseError extends SyntaxError {
    public index: number

    public lineNumber: number

    public column: number

    /**
     * Initialize this ParseError instance.
     * @param message The error message.
     * @param offset The offset number of this error.
     * @param line The line number of this error.
     * @param column The column number of this error.
     */
    public constructor(
        message: string,
        offset: number,
        line: number,
        column: number,
    ) {
        super(message)
        this.index = offset
        this.lineNumber = line
        this.column = column
    }
}
