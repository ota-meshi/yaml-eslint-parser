import assert from "assert"
import path from "path"
import fs from "fs"

import { parseForESLint } from "../../../src/parser"
import { KEYS } from "../../../src/visitor-keys"
import { traverseNodes, getKeys } from "../../../src/traverse"
import { getStaticYAMLValue } from "../../../src/utils"
import type { YAMLProgram } from "../../../src/ast"

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

            checkLoc(ast, inputFileName, input)

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

            checkLoc(ast, inputFileName, input)

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

function checkLoc(ast: YAMLProgram, fileName: string, code: string) {
    for (const token of ast.tokens) {
        assert.ok(
            token.range[0] < token.range[1],
            `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
        )
    }
    for (const token of ast.comments) {
        assert.ok(
            token.range[0] < token.range[1],
            `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
        )
    }
    traverseNodes(ast, {
        // eslint-disable-next-line complexity, no-shadow -- test
        enterNode(node, parent) {
            if (node.type !== "Program" && node.type !== "YAMLDocument") {
                assert.ok(
                    node.range[0] < node.range[1],
                    `No range on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                )
            }
            if (node.type === "YAMLWithMeta") {
                if (node.anchor && node.value) {
                    assert.ok(
                        node.anchor.range[1] <= node.value.range[0],
                        `overlap range on "${node.anchor.type} endIndex:${node.anchor.range[1]}" and "${node.value.type} startIndex:${node.value.range[0]}" in ${fileName}`,
                    )
                }
                if (node.tag && node.value) {
                    assert.ok(
                        node.tag.range[1] <= node.value.range[0],
                        `overlap range on "${node.tag.type} endIndex:${node.tag.range[1]}" and "${node.value.type} startIndex:${node.value.range[0]}" in ${fileName}`,
                    )
                }
            } else if (node.type === "YAMLPair") {
                if (node.key) {
                    if (code[node.range[0]] !== "?") {
                        assert.ok(
                            node.key.range[0] === node.range[0],
                            `The start position is off on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" > "${node.key.type} line:${node.key.loc.start.line} col:${node.key.loc.start.column}" in ${fileName}`,
                        )
                    }
                }
                if (node.value) {
                    assert.ok(
                        node.value.range[1] === node.range[1],
                        `The end position is off on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" > "${node.value.type} line:${node.value.loc.end.line} col:${node.value.loc.end.column}" in ${fileName}`,
                    )
                }
            } else if (node.type === "YAMLMapping") {
                if (node.style === "block") {
                    if (node.pairs.length) {
                        assert.ok(
                            node.pairs[0].range[0] === node.range[0],
                            `The start position is off on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" > "${node.pairs[0].type} line:${node.pairs[0].loc.start.line} col:${node.pairs[0].loc.start.column}" in ${fileName}`,
                        )
                        const last = node.pairs[node.pairs.length - 1]
                        assert.ok(
                            last.range[1] === node.range[1],
                            `The end position is off on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" > "${last.type} line:${last.loc.end.line} col:${last.loc.end.column}" in ${fileName}`,
                        )
                    }
                } else if (node.style === "flow") {
                    assert.ok(
                        code[node.range[0]] === "{",
                        `Start position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                    )
                    assert.ok(
                        code[node.range[1] - 1] === "}",
                        `End position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                    )
                }
            } else if (node.type === "YAMLSequence") {
                if (node.style === "block") {
                    if (node.entries.length) {
                        assert.ok(
                            code[node.range[0]] === "-",
                            `Start position is not "-" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                        )
                        const last = node.entries[node.entries.length - 1]
                        assert.ok(
                            last.range[1] === node.range[1],
                            `The end position is off on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" > "${last.type} line:${last.loc.end.line} col:${last.loc.end.column}" in ${fileName}`,
                        )
                    }
                } else if (node.style === "flow") {
                    assert.ok(
                        code[node.range[0]] === "[",
                        `Start position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                    )
                    assert.ok(
                        code[node.range[1] - 1] === "]",
                        `End position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                    )
                }
            } else if (node.type === "YAMLScalar") {
                // TODO
            }
            if (parent) {
                assert.ok(
                    parent.range[0] <= node.range[0],
                    `overlap range[0] on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                )
                assert.ok(
                    node.range[1] <= parent.range[1],
                    `overlap range[1] on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                )

                assert.ok(
                    parent.loc.start.line <= node.loc.start.line,
                    `overlap loc.start.line on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                )
                if (parent.loc.start.line === node.loc.start.line) {
                    assert.ok(
                        parent.loc.start.column <= node.loc.start.column,
                        `overlap loc.start.column on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                    )
                }

                assert.ok(
                    node.loc.end.line <= parent.loc.end.line,
                    `overlap loc.end.line on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                )
                if (parent.loc.end.line === node.loc.end.line) {
                    assert.ok(
                        node.loc.end.column <= parent.loc.end.column,
                        `overlap loc.end.column on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                    )
                }
            }
        },
        leaveNode() {
            // noop
        },
    })
}
