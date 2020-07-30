import {
    YAMLProgram,
    YAMLContent,
    YAMLDocument,
    YAMLMapping,
    YAMLFlowMapping,
    YAMLSequence,
    YAMLFlowSequence,
    YAMLPlain,
    YAMLDoubleQuoted,
    YAMLSingleQuoted,
    YAMLBlockLiteral,
    YAMLBlockFolded,
    YAMLAlias,
    YAMLAnchor,
    YAMLPair,
} from "./ast"

type YAMLContentValue =
    | string
    | number
    | boolean
    | null
    | YAMLContentValue[]
    | YAMLMappingValue

type YAMLMappingValue = {
    [key: string]: YAMLContentValue
    [key: number]: YAMLContentValue
}

export function getStaticYAMLValue(
    node: YAMLMapping | YAMLFlowMapping,
): YAMLMappingValue
export function getStaticYAMLValue(
    node: YAMLSequence | YAMLFlowSequence,
): YAMLContentValue[]
export function getStaticYAMLValue(
    node:
        | YAMLPlain
        | YAMLDoubleQuoted
        | YAMLSingleQuoted
        | YAMLBlockLiteral
        | YAMLBlockFolded,
): string | number | boolean | null
export function getStaticYAMLValue(node: YAMLAlias): YAMLContentValue
export function getStaticYAMLValue(
    node: YAMLProgram | YAMLDocument | YAMLContent,
): YAMLContentValue

/**
 * Gets the static value for the given node.
 */
export function getStaticYAMLValue(
    node: YAMLProgram | YAMLDocument | YAMLContent,
): YAMLContentValue {
    return resolver[node.type](node as any)
}

const resolver = {
    Program(node: YAMLProgram) {
        return node.body.length === 0
            ? null
            : node.body.length === 1
            ? // eslint-disable-next-line new-cap
              resolver.YAMLDocument(node.body[0])
            : node.body.map(resolver.YAMLDocument)
    },
    YAMLDocument(node: YAMLDocument) {
        return node.content ? getStaticYAMLValue(node.content) : null
    },
    YAMLMapping(node: YAMLMapping | YAMLFlowMapping) {
        const result: YAMLMappingValue = {}
        for (const pair of node.pairs) {
            const key = pair.key ? getStaticYAMLValue(pair.key) : null
            if (typeof key !== "string" && typeof key !== "number") {
                // illegal key
                continue
            }
            result[key] = pair.value ? getStaticYAMLValue(pair.value) : null
        }
        return result
    },
    YAMLFlowMapping(node: YAMLFlowMapping) {
        // eslint-disable-next-line new-cap
        return resolver.YAMLMapping(node)
    },
    YAMLSequence(node: YAMLSequence | YAMLFlowSequence) {
        const result: YAMLContentValue[] = []
        for (const entry of node.entries) {
            if (entry.type === "YAMLPair") {
                // illegal entry
                continue
            }
            result.push(getStaticYAMLValue(entry))
        }
        return result
    },
    YAMLFlowSequence(node: YAMLFlowSequence) {
        // eslint-disable-next-line new-cap
        return resolver.YAMLSequence(node)
    },
    YAMLPlain(node: YAMLPlain) {
        return node.value
    },
    YAMLDoubleQuoted(node: YAMLDoubleQuoted) {
        return node.value
    },
    YAMLSingleQuoted(node: YAMLSingleQuoted) {
        return node.value
    },
    YAMLBlockLiteral(node: YAMLBlockLiteral) {
        return node.value
    },
    YAMLBlockFolded(node: YAMLBlockFolded) {
        return node.value
    },
    YAMLAlias(node: YAMLAlias) {
        const anchor = findAnchor(node)
        return anchor ? getStaticYAMLValue(anchor.parent) : null
    },
}

/**
 * Find Anchor
 */
function findAnchor(node: YAMLAlias): YAMLAnchor | null {
    let p:
        | YAMLDocument
        | YAMLSequence
        | YAMLFlowSequence
        | YAMLMapping
        | YAMLFlowMapping
        | YAMLPair
        | undefined = node.parent
    let doc: YAMLDocument | null = null
    while (p) {
        if (p.type === "YAMLDocument") {
            doc = p
            break
        }
        p = p.parent
    }
    return doc!.anchors[node.name] || null
}
