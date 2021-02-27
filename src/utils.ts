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
    return getValue(node, null)
}

/**
 * Gets the static value for the given node with YAML version.
 */
function getValue(
    node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair | YAMLWithMeta,
    version: "1.2" | "1.1" | null,
): YAMLContentValue {
    return resolver[node.type](node as never, version)
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
        return node.content
            ? getValue(node.content, getYAMLVersion(node))
            : null
    },
    YAMLMapping(node: YAMLMapping, version: "1.2" | "1.1" | null) {
        const result: YAMLMappingValue = {}
        for (const pair of node.pairs) {
            Object.assign(result, getValue(pair, version))
        }
        return result
    },
    YAMLPair(node: YAMLPair, version: "1.2" | "1.1" | null) {
        const result: YAMLMappingValue = {}
        let key = node.key ? getValue(node.key, version) : null
        if (typeof key !== "string" && typeof key !== "number") {
            key = String(key)
        }
        result[key] = node.value ? getValue(node.value, version) : null
        return result
    },
    YAMLSequence(node: YAMLSequence, version: "1.2" | "1.1" | null) {
        const result: YAMLContentValue[] = []
        for (const entry of node.entries) {
            result.push(entry ? getValue(entry, version) : null)
        }
        return result
    },
    YAMLScalar(node: YAMLScalar) {
        return node.value
    },
    YAMLAlias(node: YAMLAlias, version: "1.2" | "1.1" | null) {
        const anchor = findAnchor(node)
        return anchor ? getValue(anchor.parent, version) : null
    },
    YAMLWithMeta(node: YAMLWithMeta, version: "1.2" | "1.1" | null) {
        if (node.tag) {
            if (node.value == null) {
                return getTaggedValue(node.tag, "", "", version)
            }
            if (node.value.type === "YAMLScalar") {
                if (node.value.style === "plain") {
                    return getTaggedValue(
                        node.tag,
                        node.value.strValue,
                        node.value.strValue,
                        version,
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
                        version,
                    )
                }
            }
        }
        if (node.value == null) {
            return null
        }
        return getValue(node.value, version)
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
function getTaggedValue(
    tag: YAMLTag,
    text: string,
    str: string,
    version: "1.2" | "1.1" | null,
) {
    for (const tagResolver of tagResolvers[version || "1.2"]) {
        if (tagResolver.tag === tag.tag && tagResolver.test(str)) {
            return tagResolver.resolve(str)
        }
    }
    const tagText = tag.tag.startsWith("!") ? tag.tag : `!<${tag.tag}>`
    const value = parseDocument(`${tagText} ${text}`).toJSON()
    return value
}

/**
 * Get YAML version from then given document
 */
export function getYAMLVersion(document: YAMLDocument): "1.2" | "1.1" {
    for (const dir of document.directives) {
        const yamlVer = /^%YAML\s+(\d\.\d)$/.exec(dir.value)?.[1]
        if (yamlVer) {
            if (yamlVer === "1.1") {
                return "1.1"
            }
            if (yamlVer === "1.2") {
                return "1.2"
            }
            // Other versions are not supported
            return "1.2"
        }
    }
    return "1.2"
}
