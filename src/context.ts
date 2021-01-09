import type {
    Comment,
    Locations,
    Position,
    Range,
    Token,
    YAMLProgram,
} from "./ast"
import type { ASTNode } from "./yaml"
import lodash from "lodash"
import { traverseNodes } from "./traverse"

type CSTRangeData = {
    start: number
    end: number
}
export class Context {
    public readonly code: string

    public readonly tokens: Token[] = []

    public readonly comments: Comment[] = []

    public hasCR = false

    private readonly locs: LinesAndColumns

    private readonly locsMap = new Map<number, Position>()

    private readonly crs: number[]

    public constructor(origCode: string) {
        const len = origCode.length
        const lineStartIndices = [0]
        const crs: number[] = []
        let code = ""
        for (let index = 0; index < len; ) {
            const c = origCode[index++]
            if (c === "\r") {
                const next = origCode[index++] || ""
                if (next === "\n") {
                    code += next
                    crs.push(index - 2)
                } else {
                    code += `\n${next}`
                }
                lineStartIndices.push(code.length)
            } else {
                code += c
                if (c === "\n") {
                    lineStartIndices.push(code.length)
                }
            }
        }
        this.code = code
        this.locs = new LinesAndColumns(lineStartIndices)
        this.hasCR = Boolean(crs.length)
        this.crs = crs
    }

    public remapCR(ast: YAMLProgram): void {
        const cache: Record<number, number> = {}
        const remapIndex = (index: number): number => {
            let result = cache[index]
            if (result != null) {
                return result
            }
            result = index
            for (const cr of this.crs) {
                if (cr < result) {
                    result++
                } else {
                    break
                }
            }
            return (cache[index] = result)
        }
        // eslint-disable-next-line func-style -- ignore
        const remapRange = (range: [number, number]): [number, number] => {
            return [remapIndex(range[0]), remapIndex(range[1])]
        }

        traverseNodes(ast, {
            enterNode(node) {
                node.range = remapRange(node.range)
            },
            leaveNode() {
                // ignore
            },
        })
        for (const token of ast.tokens) {
            token.range = remapRange(token.range)
        }
        for (const comment of ast.comments) {
            comment.range = remapRange(comment.range)
        }
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
     * Get the location information of the given node.
     * @param node The node.
     */
    public getConvertLocation(node: { range: Range } | ASTNode): Locations {
        const [start, end] = node.range!

        return {
            range: [start, end],
            loc: {
                start: this.getLocFromIndex(start),
                end: this.getLocFromIndex(end),
            },
        }
    }

    /**
     * Get the location information of the given CSTRange.
     * @param node The node.
     */
    public getConvertLocationFromCSTRange(
        range: CSTRangeData | undefined | null,
    ): Locations {
        return this.getConvertLocation({ range: [range!.start, range!.end] })
    }

    public addComment(comment: Comment): void {
        this.comments.push(comment)
    }

    /**
     * Add token to tokens
     */
    public addToken(type: Token["type"], range: Range): Token {
        const token = {
            type,
            value: this.code.slice(...range),
            ...this.getConvertLocation({ range }),
        }
        this.tokens.push(token)
        return token
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
