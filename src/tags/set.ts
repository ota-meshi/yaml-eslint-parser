import type { YAMLMapping } from "../ast";
import { getStaticYAMLValue } from "../utils";
import type { TagNodeResolver } from "./commons";

export const SET: TagNodeResolver<any[]> = {
  // see https://yaml.org/type/set.html
  tag: "tag:yaml.org,2002:set",
  testNode(node) {
    return (
      node.type === "YAMLMapping" &&
      node.pairs.every((p) => p.key != null && p.value == null)
    );
  },
  resolveNode(node) {
    const map = node as YAMLMapping;
    const result = [];
    for (const p of map.pairs) {
      result.push(getStaticYAMLValue(p.key!));
    }
    return result;
  },
};
