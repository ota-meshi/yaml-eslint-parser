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
} from "./ast";
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

/**
 * Find the insertion position (index) of an item in an array with items sorted
 * in ascending order; so that `splice(sortedIndex, 0, item)` would result in
 * maintaining the array's sort-ness. The array can contain duplicates.
 * If the item already exists in the array the index would be of the *last*
 * occurrence of the item.
 *
 * Runs in O(logN) time.
 *
 * MIT License | Copyright (c) 2018 remeda | https://remedajs.com/
 *
 * The implementation is copied from remeda package:
 * https://github.com/remeda/remeda/blob/878206eb3e8ec1c7f1300b1909b7aa629810c8bb/src/sortedLastIndex.ts
 * https://github.com/remeda/remeda/blob/878206eb3e8ec1c7f1300b1909b7aa629810c8bb/src/internal/binarySearchCutoffIndex.ts#L1
 *
 * @param data - The (ascending) sorted array.
 * @param item - The item to insert.
 * @returns Insertion index (In the range 0..data.length).
 * @signature
 *    sortedLastIndex(data, item)
 * @example
 *    sortedLastIndex(['a','a','b','c','c'], 'c') // => 5
 */
export function sortedLastIndex<T>(array: readonly T[], item: T): number {
  let lowIndex = 0;
  let highIndex = array.length;

  while (lowIndex < highIndex) {
    const pivotIndex = (lowIndex + highIndex) >>> 1;
    const pivot = array[pivotIndex];

    if (pivot <= item) {
      lowIndex = pivotIndex + 1;
    } else {
      highIndex = pivotIndex;
    }
  }

  return highIndex;
}
