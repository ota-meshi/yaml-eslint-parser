import {
    YAMLProgram,
    YAMLContent,
    YAMLDocument,
    YAMLMapping,
    YAMLSequence,
    YAMLScalar,
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
    node: YAMLMapping | YAMLPair,
): YAMLMappingValue
export function getStaticYAMLValue(node: YAMLSequence): YAMLContentValue[]
export function getStaticYAMLValue(
    node: YAMLScalar,
): string | number | boolean | null
export function getStaticYAMLValue(node: YAMLAlias): YAMLContentValue
export function getStaticYAMLValue(
    node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair,
): YAMLContentValue

/**
 * Gets the static value for the given node.
 */
export function getStaticYAMLValue(
    node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair,
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
    YAMLMapping(node: YAMLMapping) {
        const result: YAMLMappingValue = {}
        for (const pair of node.pairs) {
            Object.assign(result, getStaticYAMLValue(pair))
        }
        return result
    },
    YAMLPair(node: YAMLPair) {
        const result: YAMLMappingValue = {}
        let key = node.key ? getStaticYAMLValue(node.key) : null
        if (typeof key !== "string" && typeof key !== "number") {
            key = String(key)
        }
        result[key] = node.value ? getStaticYAMLValue(node.value) : null
        return result
    },
    YAMLSequence(node: YAMLSequence) {
        const result: YAMLContentValue[] = []
        for (const entry of node.entries) {
            result.push(getStaticYAMLValue(entry))
        }
        return result
    },
    YAMLScalar(node: YAMLScalar) {
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
    let p: YAMLDocument | YAMLSequence | YAMLMapping | YAMLPair | undefined =
        node.parent
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
