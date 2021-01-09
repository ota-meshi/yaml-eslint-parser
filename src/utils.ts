import { parseDocument } from "yaml"
import type {
    YAMLProgram,
    YAMLContent,
    YAMLDocument,
    YAMLMapping,
    YAMLSequence,
    YAMLScalar,
    YAMLAlias,
    YAMLAnchor,
    YAMLPair,
    YAMLWithMeta,
    YAMLTag,
} from "./ast"
import { tagResolvers } from "./tags"

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
export function getStaticYAMLValue(
    node:
        | YAMLAlias
        | YAMLProgram
        | YAMLDocument
        | YAMLContent
        | YAMLPair
        | YAMLWithMeta,
): YAMLContentValue

/**
 * Gets the static value for the given node.
 */
export function getStaticYAMLValue(
    node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair | YAMLWithMeta,
): YAMLContentValue {
    return resolver[node.type](node as never)
}

const resolver = {
    Program(node: YAMLProgram) {
        return node.body.length === 0
            ? null
            : node.body.length === 1
            ? // eslint-disable-next-line new-cap -- traverse key
              resolver.YAMLDocument(node.body[0])
            : // eslint-disable-next-line new-cap -- traverse key
              node.body.map((n) => resolver.YAMLDocument(n))
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
            result.push(entry ? getStaticYAMLValue(entry) : null)
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
    YAMLWithMeta(node: YAMLWithMeta) {
        if (node.tag) {
            if (node.value == null) {
                return getTaggedValue(node.tag, "", "")
            }
            if (node.value.type === "YAMLScalar") {
                if (node.value.style === "plain") {
                    return getTaggedValue(
                        node.tag,
                        node.value.strValue,
                        node.value.strValue,
                    )
                }
                if (
                    node.value.style === "double-quoted" ||
                    node.value.style === "single-quoted"
                ) {
                    return getTaggedValue(
                        node.tag,
                        node.value.raw,
                        node.value.strValue,
                    )
                }
            }
        }
        if (node.value == null) {
            return null
        }
        return getStaticYAMLValue(node.value)
    },
}

/**
 * Find Anchor
 */
function findAnchor(node: YAMLAlias): YAMLAnchor | null {
    let p:
        | YAMLDocument
        | YAMLSequence
        | YAMLMapping
        | YAMLPair
        | YAMLWithMeta
        | undefined = node.parent
    let doc: YAMLDocument | null = null
    while (p) {
        if (p.type === "YAMLDocument") {
            doc = p
            break
        }
        p = p.parent
    }
    const anchors = doc!.anchors[node.name]
    if (!anchors) {
        return null
    }
    let target: { anchor: null | YAMLAnchor; distance: number } = {
        anchor: null,
        distance: Infinity,
    }
    for (const anchor of anchors) {
        if (anchor.range[0] < node.range[0]) {
            const distance = node.range[0] - anchor.range[0]
            if (target.distance >= distance) {
                target = {
                    anchor,
                    distance,
                }
            }
        }
    }
    return target.anchor
}

/**
 * Get tagged value
 */
function getTaggedValue(tag: YAMLTag, text: string, str: string) {
    for (const tagResolver of tagResolvers) {
        if (tagResolver.tag === tag.tag && tagResolver.test(str)) {
            return tagResolver.resolve(str)
        }
    }
    const tagText = tag.tag.startsWith("!") ? tag.tag : `!<${tag.tag}>`
    const value = parseDocument(`${tagText} ${text}`).toJSON()
    return value
}
