import type { CST, Document } from "yaml"
import { Composer, Parser } from "yaml"
import type { Context } from "./context"

/** Parse yaml to CST */
export function parseAllDocsToCST(ctx: Context): {
    cstNodes: CST.Token[]
    nodes: Document.Parsed[]
} {
    const parser = new Parser()
    const composer = new Composer({
        keepSourceTokens: true,
    })
    const cstNodes: CST.Token[] = []
    const nodes: Document.Parsed[] = []

    for (const doc of composer.compose(
        (function* () {
            for (const cst of parser.parse(ctx.code)) {
                cstNodes.push(cst)
                yield cst
            }
        })(),
    )) {
        for (const error of doc.errors) {
            throw ctx.throwError(error.message, error.pos[0])
        }
        // ignore warns
        // for (const error of doc.warnings) {
        //     throw ctx.throwError(error.message, error.pos[0])
        // }
        nodes.push(doc)
    }

    return { cstNodes, nodes }
}
