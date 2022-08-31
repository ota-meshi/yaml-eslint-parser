import { parseDocument } from "yaml";
import type { Directives } from "yaml/dist/doc/directives";
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
} from "./ast";
import { tagNodeResolvers, tagResolvers } from "./tags";

export type YAMLVersion = Directives["yaml"]["version"];

export type YAMLContentValue =
  | string
  | number
  | boolean
  | null
  | YAMLContentValue[]
  | YAMLMappingValue;

export type YAMLMappingValue = {
  [key: string]: YAMLContentValue;
  [key: number]: YAMLContentValue;
};

export function getStaticYAMLValue(
  node: YAMLMapping | YAMLPair
): YAMLMappingValue;
export function getStaticYAMLValue(node: YAMLSequence): YAMLContentValue[];
export function getStaticYAMLValue(
  node: YAMLScalar
): string | number | boolean | null;
export function getStaticYAMLValue(
  node:
    | YAMLAlias
    | YAMLProgram
    | YAMLDocument
    | YAMLContent
    | YAMLPair
    | YAMLWithMeta
): YAMLContentValue;

/**
 * Gets the static value for the given node.
 */
export function getStaticYAMLValue(
  node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair | YAMLWithMeta
): YAMLContentValue {
  return getValue(node, null);
}

/**
 * Gets the static value for the given node with YAML version.
 */
function getValue(
  node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair | YAMLWithMeta,
  version: YAMLVersion | null
): YAMLContentValue {
  return resolver[node.type](node as never, version);
}

const resolver = {
  Program(node: YAMLProgram) {
    return node.body.length === 0
      ? null
      : node.body.length === 1
      ? // eslint-disable-next-line new-cap -- traverse key
        resolver.YAMLDocument(node.body[0])
      : // eslint-disable-next-line new-cap -- traverse key
        node.body.map((n) => resolver.YAMLDocument(n));
  },
  YAMLDocument(node: YAMLDocument) {
    return node.content ? getValue(node.content, node.version) : null;
  },
  YAMLMapping(node: YAMLMapping, version: YAMLVersion | null) {
    const result: YAMLMappingValue = {};
    for (const pair of node.pairs) {
      Object.assign(result, getValue(pair, version));
    }
    return result;
  },
  YAMLPair(node: YAMLPair, version: YAMLVersion | null) {
    const result: YAMLMappingValue = {};
    let key = node.key ? getValue(node.key, version) : null;
    if (typeof key !== "string" && typeof key !== "number") {
      key = String(key);
    }
    result[key] = node.value ? getValue(node.value, version) : null;
    return result;
  },
  YAMLSequence(node: YAMLSequence, version: YAMLVersion | null) {
    const result: YAMLContentValue[] = [];
    for (const entry of node.entries) {
      result.push(entry ? getValue(entry, version) : null);
    }
    return result;
  },
  YAMLScalar(node: YAMLScalar) {
    return node.value;
  },
  YAMLAlias(node: YAMLAlias, version: YAMLVersion | null) {
    const anchor = findAnchor(node);
    return anchor ? getValue(anchor.parent, version) : null;
  },
  YAMLWithMeta(node: YAMLWithMeta, version: YAMLVersion | null) {
    if (node.tag) {
      const value = node.value;
      if (value == null) {
        return getTaggedValue(node.tag, "", "", version);
      }
      if (value.type === "YAMLScalar") {
        if (value.style === "plain") {
          return getTaggedValue(
            node.tag,
            value.strValue,
            value.strValue,
            version
          );
        }
        if (
          value.style === "double-quoted" ||
          value.style === "single-quoted"
        ) {
          return getTaggedValue(node.tag, value.raw, value.strValue, version);
        }
      }

      for (const tagResolver of tagNodeResolvers[version || "1.2"]) {
        if (tagResolver.tag === node.tag.tag && tagResolver.testNode(value)) {
          return tagResolver.resolveNode(value);
        }
      }
    }
    if (node.value == null) {
      return null;
    }
    return getValue(node.value, version);
  },
};

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
    | undefined = node.parent;
  let doc: YAMLDocument | null = null;
  while (p) {
    if (p.type === "YAMLDocument") {
      doc = p;
      break;
    }
    p = p.parent;
  }
  const anchors = doc!.anchors[node.name];
  if (!anchors) {
    return null;
  }
  let target: { anchor: null | YAMLAnchor; distance: number } = {
    anchor: null,
    distance: Infinity,
  };
  for (const anchor of anchors) {
    if (anchor.range[0] < node.range[0]) {
      const distance = node.range[0] - anchor.range[0];
      if (target.distance >= distance) {
        target = {
          anchor,
          distance,
        };
      }
    }
  }
  return target.anchor;
}

/**
 * Get tagged value
 */
function getTaggedValue(
  tag: YAMLTag,
  text: string,
  str: string,
  version: YAMLVersion | null
) {
  for (const tagResolver of tagResolvers[version || "1.2"]) {
    if (tagResolver.tag === tag.tag && tagResolver.testString(str)) {
      return tagResolver.resolveString(str);
    }
  }
  const tagText = tag.tag.startsWith("!") ? tag.tag : `!<${tag.tag}>`;
  const value = parseDocument(`${version ? `%YAML ${version}` : ""}
---
${tagText} ${text}`).toJSON();
  return value;
}
