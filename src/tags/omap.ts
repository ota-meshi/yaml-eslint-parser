import type { YAMLMapping, YAMLSequence } from "../ast"
import { getStaticYAMLValue } from "../utils"
import type { TagNodeResolver } from "./commons"

export const OMAP: TagNodeResolver<Record<any, any>> = {
    // see https://yaml.org/type/omap.html
    tag: "tag:yaml.org,2002:omap",
    testNode(node) {
        return (
            node.type === "YAMLSequence" &&
            node.entries.every(
                (e) => e?.type === "YAMLMapping" && e.pairs.length === 1,
            )
        )
    },
    resolveNode(node) {
        const seq = node as YAMLSequence
        const result: Record<any, any> = {}
        for (const e of seq.entries) {
            const map = e as YAMLMapping
            for (const p of map.pairs) {
                const key = p.key ? getStaticYAMLValue(p.key) : p.key
                const value = p.value ? getStaticYAMLValue(p.value) : p.value
                result[key as any] = value
            }
        }
        return result
    },
}
