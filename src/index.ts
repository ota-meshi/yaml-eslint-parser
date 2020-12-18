import { parseForESLint, ParseError } from "./parser"
import type * as AST from "./ast"
import { traverseNodes } from "./traverse"
import { getStaticYAMLValue } from "./utils"
import { KEYS } from "./visitor-keys"

export { AST, ParseError }

// parser
export { parseForESLint }
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS

// tools
export { traverseNodes, getStaticYAMLValue }

/**
 * Parse YAML source code
 */
export function parseYAML(code: string, _options?: any): AST.YAMLProgram {
    return parseForESLint(code).ast
}
