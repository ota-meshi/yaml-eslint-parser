import type { SourceCode } from "eslint"
import { unionWith } from "eslint-visitor-keys"
import { YAMLNode } from "./ast"

const yamlKeys: { [key in YAMLNode["type"]]: string[] } = {
    Program: ["body"],
    YAMLDocument: ["directives", "content"],
    YAMLDirective: [],
    YAMLMapping: ["pairs", "anchor", "tag"],
    YAMLFlowMapping: ["pairs", "anchor", "tag"],
    YAMLPair: ["key", "value"],
    YAMLSequence: ["entries", "anchor", "tag"],
    YAMLFlowSequence: ["entries", "anchor", "tag"],

    YAMLPlain: ["anchor", "tag"],
    YAMLDoubleQuoted: ["anchor", "tag"],
    YAMLSingleQuoted: ["anchor", "tag"],
    YAMLBlockLiteral: ["anchor", "tag"],
    YAMLBlockFolded: ["anchor", "tag"],
    YAMLAlias: ["anchor", "tag"],

    YAMLAnchor: [],
    YAMLTag: [],
}

export const KEYS: SourceCode.VisitorKeys = unionWith(
    yamlKeys,
) as SourceCode.VisitorKeys
