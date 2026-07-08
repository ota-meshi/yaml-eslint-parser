import { parseDocument, type DocumentOptions } from "yaml";
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
} from "./ast.ts";
import { tagNodeResolvers, tagResolvers } from "./tags";

export type YAMLVersion = NonNullable<DocumentOptions["version"]>;

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

// The YAML merge key. In YAML 1.1 a plain `<<` key merges the referenced
// mapping(s) into the enclosing mapping. See https://yaml.org/type/merge.html
const MERGE_KEY = "<<";

export function getStaticYAMLValue(
  node: YAMLMapping | YAMLPair,
): YAMLMappingValue;
export function getStaticYAMLValue(node: YAMLSequence): YAMLContentValue[];
export function getStaticYAMLValue(
  node: YAMLScalar,
): string | number | boolean | null;
export function getStaticYAMLValue(
  node:
    | YAMLAlias
    | YAMLProgram
    | YAMLDocument
    | YAMLContent
    | YAMLPair
    | YAMLWithMeta,
): YAMLContentValue;

/**
 * Gets the static value for the given node.
 */
export function getStaticYAMLValue(
  node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair | YAMLWithMeta,
): YAMLContentValue {
  return getValue(node, null);
}

/**
 * Gets the static value for the given node with YAML version.
 */
function getValue(
  node: YAMLProgram | YAMLDocument | YAMLContent | YAMLPair | YAMLWithMeta,
  version: YAMLVersion | null,
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
      const mergeSources =
        version === "1.1" && isMergeKeyPair(pair)
          ? toMergeSources(getValue(pair.value, version))
          : null;
      if (mergeSources) {
        // A merge key (`<<`) only fills in keys that are not already present,
        // so keys defined directly on this mapping (and keys from earlier
        // merge sources) take precedence over the merged ones.
        for (const source of mergeSources) {
          for (const key of Object.keys(source)) {
            if (!Object.prototype.hasOwnProperty.call(result, key)) {
              result[key] = source[key];
            }
          }
        }
      } else {
        Object.assign(result, getValue(pair, version));
      }
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
            version,
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
 * Checks whether the given pair is a YAML merge key pair (a plain `<<` key).
 * A quoted or tagged `<<` is a normal key, so only a plain scalar counts.
 */
function isMergeKeyPair(
  pair: YAMLPair,
): pair is YAMLPair & { value: YAMLContent | YAMLWithMeta } {
  const key = pair.key;
  return (
    pair.value != null &&
    key != null &&
    key.type === "YAMLScalar" &&
    key.style === "plain" &&
    key.strValue === MERGE_KEY
  );
}

/**
 * Normalizes the static value of a merge key (`<<`) into the mappings to merge
 * in. A single mapping yields one source; a sequence yields one source per
 * item, applied in order. Returns `null` when the value cannot be merged, in
 * which case `<<` is treated as a normal key.
 */
function toMergeSources(value: YAMLContentValue): YAMLMappingValue[] | null {
  if (Array.isArray(value)) {
    const sources: YAMLMappingValue[] = [];
    for (const item of value) {
      if (!isMapValue(item)) {
        return null;
      }
      sources.push(item);
    }
    return sources;
  }
  if (isMapValue(value)) {
    return [value];
  }
  return null;
}

/**
 * Checks whether the given static value is a mapping value (a plain object).
 */
function isMapValue(value: YAMLContentValue): value is YAMLMappingValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  version: YAMLVersion | null,
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
