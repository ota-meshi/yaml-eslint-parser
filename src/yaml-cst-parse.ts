import type { CST, Document } from "yaml"
import { Composer, LineCounter, Parser } from "yaml"
import type { Context } from "./context"

/** Parse yaml to CST */
export function parseAllDocsToCST(ctx: Context): {
    cstNodes: CST.Token[]
    nodes: Document.Parsed[]
} {
    const lineCounter = new LineCounter()
    const parser = new Parser(lineCounter.addNewLine)
    const composer = new Composer({
        keepSourceTokens: true,
        // lineCounter,
        // prettyErrors: false,
    })
    const cstNodes: CST.Token[] = []
    const nodes = Array.from(
        composer.compose(
            (function* () {
                for (const cst of parser.parse(ctx.code)) {
                    cstNodes.push(cst)
                    yield cst
                }
            })(),
        ),
    )
    for (const doc of nodes) {
        for (const error of doc.errors) {
            throw ctx.throwError(error.message, error.pos[0])
        }
        // ignore warns
        // for (const error of doc.warnings) {
        //     throw ctx.throwError(error.message, error.pos[0])
        // }
    }

    return { cstNodes, nodes }
}
