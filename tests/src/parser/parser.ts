import assert from "assert"
import path from "path"
import fs from "fs"

import { parseForESLint } from "../../../src/parser"
import { KEYS } from "../../../src/visitor-keys"
import { traverseNodes, getKeys } from "../../../src/traverse"
import { getStaticYAMLValue } from "../../../src/utils"
import { YAMLProgram } from "../../../src/ast"

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast")
const SUITE_FIXTURE_ROOT = path.resolve(
    __dirname,
    "../../fixtures/parser/yaml-test-suite",
)

/**
 * Remove `parent` properties from the given AST.
 */
function replacer(key: string, value: any) {
    if (key === "parent" || key === "anchors") {
        return undefined
    }
    if (value instanceof RegExp) {
        return String(value)
    }
    if (typeof value === "bigint") {
        return null // Make it null so it can be checked on node8.
        // return `${String(value)}n`
    }
    return value
}

function parse(code: string) {
    return parseForESLint(code, {})
}

describe("Check for AST.", () => {
    for (const filename of fs
        .readdirSync(AST_FIXTURE_ROOT)
        .filter((f) => f.endsWith("input.yaml"))) {
        it(filename, () => {
            const inputFileName = path.join(AST_FIXTURE_ROOT, filename)
            const outputFileName = inputFileName.replace(
                /input\.yaml$/u,
                "output.json",
            )
            const valueFileName = inputFileName.replace(
                /input\.yaml$/u,
                "value.json",
            )

            const input = fs.readFileSync(inputFileName, "utf8")
            const ast = parse(input).ast
            const astJson = JSON.stringify(ast, replacer, 2)
            const output = fs.readFileSync(outputFileName, "utf8")
            assert.strictEqual(astJson, output)

            // check tokens
            checkTokens(ast, input)

            // check getStaticYAMLValue
            const value = fs.readFileSync(valueFileName, "utf8")
            assert.strictEqual(
                JSON.stringify(getStaticYAMLValue(ast), null, 2),
                value,
            )
        })
    }
})

describe("yaml-test-suite.", () => {
    for (const filename of fs
        .readdirSync(SUITE_FIXTURE_ROOT)
        .filter((f) => f.endsWith("input.yaml"))) {
        it(filename, () => {
            const inputFileName = path.join(SUITE_FIXTURE_ROOT, filename)
            const outputFileName = inputFileName.replace(
                /input\.yaml$/u,
                "output.json",
            )
            const valueFileName = inputFileName.replace(
                /input\.yaml$/u,
                "value.json",
            )

            const input = fs.readFileSync(inputFileName, "utf8")
            const output = fs.readFileSync(outputFileName, "utf8")

            let ast
            try {
                ast = parse(input).ast
            } catch (e) {
                if (
                    typeof e.lineNumber === "number" &&
                    typeof e.column === "number"
                ) {
                    assert.strictEqual(
                        `${e.message}@line:${e.lineNumber},column:${e.column}`,
                        output,
                    )
                    return
                }
                throw e
            }
            const astJson = JSON.stringify(ast, replacer, 2)
            assert.strictEqual(astJson, output)

            // check tokens
            checkTokens(ast, input)

            // check keys
            traverseNodes(ast, {
                enterNode(node) {
                    const allKeys = KEYS[node.type]
                    for (const key of getKeys(node, {})) {
                        assert.ok(allKeys.includes(key), `missing '${key}' key`)
                    }
                },
                leaveNode() {
                    // noop
                },
            })

            // check getStaticYAMLValue
            const value = fs.readFileSync(valueFileName, "utf8")
            assert.strictEqual(
                JSON.stringify(getStaticYAMLValue(ast), null, 2),
                value,
            )
        })
    }
})

function checkTokens(ast: YAMLProgram, input: string) {
    const allTokens = [...ast.tokens, ...ast.comments].sort(
        (a, b) => a.range[0] - b.range[0],
    )

    assert.strictEqual(
        input.replace(/\s/gu, ""),
        allTokens
            .map((t) => (t.type === "Block" ? `#${t.value}` : t.value))
            .join("")
            .replace(/\s/gu, ""),
    )
}
