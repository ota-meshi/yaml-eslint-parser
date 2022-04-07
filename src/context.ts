import type { Comment, Locations, Position, Range, Token } from "./ast"
import lodash from "lodash"
import type { CST } from "yaml"
import { ParseError } from "."

export class Context {
    public readonly code: string

    public readonly tokens: Token[] = []

    public readonly comments: Comment[] = []

    private readonly locs: LinesAndColumns

    private readonly locsMap = new Map<number, Position>()

    public constructor(origCode: string) {
        const len = origCode.length
        const lineStartIndices = [0]
        for (let index = 0; index < len; ) {
            const c = origCode[index++]
            if (c === "\r") {
                const next = origCode[index]
                if (next === "\n") {
                    index++
                }
                lineStartIndices.push(index)
            } else if (c === "\n") {
                lineStartIndices.push(index)
            }
        }
        this.code = origCode
        this.locs = new LinesAndColumns(lineStartIndices)
    }

    public getLocFromIndex(index: number): { line: number; column: number } {
        let loc = this.locsMap.get(index)
        if (!loc) {
            loc = this.locs.getLocFromIndex(index)
            this.locsMap.set(index, loc)
        }
        return {
            line: loc.line,
            column: loc.column,
        }
    }

    /**
     * Get the location information of the given range.
     */
    public getConvertLocation(start: number, end: number): Locations {
        return {
            range: [start, end],
            loc: {
                start: this.getLocFromIndex(start),
                end: this.getLocFromIndex(end),
            },
        }
    }

    public addComment(comment: Comment): void {
        this.comments.push(comment)
    }

    /**
     * Add token to tokens
     */
    public addToken(type: Token["type"], range: Readonly<Range>): Token {
        const token = {
            type,
            value: this.code.slice(...range),
            ...this.getConvertLocation(...range),
        }
        this.tokens.push(token)
        return token
    }

    /* istanbul ignore next */
    public throwUnexpectedTokenError(cst: CST.Token | Token): ParseError {
        const token = "source" in cst ? `'${cst.source}'` : cst.type
        throw this.throwError(`Unexpected token: ${token}`, cst)
    }

    public throwError(
        message: string,
        cst: CST.Token | Token | number,
    ): ParseError {
        const offset =
            typeof cst === "number"
                ? cst
                : "offset" in cst
                ? cst.offset
                : cst.range[0]
        const loc = this.getLocFromIndex(offset)
        throw new ParseError(message, offset, loc.line, loc.column)
    }

    /**
     * Gets the last index with whitespace skipped.
     */
    public lastSkipSpaces(startIndex: number, endIndex: number): number {
        const str = this.code
        for (let index = endIndex - 1; index >= startIndex; index--) {
            if (str[index].trim()) {
                return index + 1
            }
        }
        return startIndex
    }
}

class LinesAndColumns {
    private readonly lineStartIndices: number[]

    public constructor(lineStartIndices: number[]) {
        this.lineStartIndices = lineStartIndices
    }

    public getLocFromIndex(index: number) {
        const lineNumber = lodash.sortedLastIndex(this.lineStartIndices, index)
        return {
            line: lineNumber,
            column: index - this.lineStartIndices[lineNumber - 1],
        }
    }
}
