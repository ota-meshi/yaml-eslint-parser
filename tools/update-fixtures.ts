import path from "path"
import fs from "fs"

import { parseForESLint } from "../src/parser"
import { getStaticYAMLValue } from "../src/utils"

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../tests/fixtures/parser/ast")
const SUITE_FIXTURE_ROOT = path.resolve(
    __dirname,
    "../tests/fixtures/parser/yaml-test-suite",
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

/**
 * Parse
 */
function parse(code: string) {
    return parseForESLint(code, {})
}

for (const filename of fs
    .readdirSync(AST_FIXTURE_ROOT)
    .filter((f) => f.endsWith("input.yaml"))) {
    const inputFileName = path.join(AST_FIXTURE_ROOT, filename)
    const outputFileName = inputFileName.replace(/input\.yaml$/u, "output.json")
    const valueFileName = inputFileName.replace(/input\.yaml$/u, "value.json")

    const input = fs.readFileSync(inputFileName, "utf8")
    try {
        const ast = parse(input).ast
        const astJson = JSON.stringify(ast, replacer, 2)
        fs.writeFileSync(outputFileName, astJson, "utf8")
        fs.writeFileSync(
            valueFileName,
            JSON.stringify(getStaticYAMLValue(ast), null, 2),
            "utf8",
        )
    } catch (e) {
        fs.writeFileSync(
            outputFileName,
            `${e.message}@line:${e.lineNumber},column:${e.column}`,
            "utf8",
        )
    }
}

for (const filename of fs
    .readdirSync(SUITE_FIXTURE_ROOT)
    .filter((f) => f.endsWith("input.yaml"))) {
    const inputFileName = path.join(SUITE_FIXTURE_ROOT, filename)
    const outputFileName = inputFileName.replace(/input\.yaml$/u, "output.json")
    const valueFileName = inputFileName.replace(/input\.yaml$/u, "value.json")

    const input = fs.readFileSync(inputFileName, "utf8")
    try {
        const ast = parse(input).ast
        const astJson = JSON.stringify(ast, replacer, 2)
        fs.writeFileSync(outputFileName, astJson, "utf8")
        fs.writeFileSync(
            valueFileName,
            JSON.stringify(getStaticYAMLValue(ast), null, 2),
            "utf8",
        )
    } catch (e) {
        if (typeof e.lineNumber === "number" && typeof e.column === "number") {
            fs.writeFileSync(
                outputFileName,
                `${e.message}@line:${e.lineNumber},column:${e.column}`,
                "utf8",
            )
        } else {
            throw e
        }
    }
}
