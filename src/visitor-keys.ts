import type { SourceCode } from "eslint"
import { unionWith } from "eslint-visitor-keys"
import type { YAMLNode } from "./ast"

const yamlKeys: { [key in YAMLNode["type"]]: string[] } = {
    Program: ["body"],
    YAMLDocument: ["directives", "content"],
    YAMLDirective: [],
    YAMLMapping: ["pairs"],
    YAMLPair: ["key", "value"],
    YAMLSequence: ["entries"],

    YAMLWithMeta: ["anchor", "tag", "value"],

    YAMLScalar: [],
    YAMLAlias: [],

    YAMLAnchor: [],
    YAMLTag: [],
}

export const KEYS: SourceCode.VisitorKeys = unionWith(
    yamlKeys,
) as SourceCode.VisitorKeys
