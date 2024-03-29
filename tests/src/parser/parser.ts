/* eslint complexity:0 -- ignore */
import assert from "assert";
import path from "path";
import fs from "fs";

import YAML from "yaml";
import { KEYS } from "../../../src/visitor-keys";
import { traverseNodes, getKeys } from "../../../src/traverse";
import { getStaticYAMLValue } from "../../../src/utils";
import type { YAMLProgram } from "../../../src/ast";
import { parseYAML } from "../../../src";
import { astToJson, listupFixtures, valueToJson } from "../test-utils";
import { parserOptionsToYAMLOption } from "../../../src/options";

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast");
const SUITE_FIXTURE_ROOT = path.resolve(
  __dirname,
  "../../fixtures/parser/yaml-test-suite",
);

function parse(code: string, parserOptions: any, filePath: string) {
  return parseYAML(code, { ...(parserOptions || {}), filePath });
}

describe("Check for AST.", () => {
  for (const fixture of listupFixtures(AST_FIXTURE_ROOT)) {
    describe(fixture.filename, () => {
      const {
        input,
        inputFileName,
        parserOptions,
        outputFileName,
        valueFileName,
      } = fixture;

      let ast: any;

      it("most to generate the expected AST.", () => {
        try {
          ast = parse(input, parserOptions, inputFileName);
        } catch (e: any) {
          if (
            typeof e.lineNumber === "number" &&
            typeof e.column === "number"
          ) {
            const output = fs.readFileSync(outputFileName, "utf8");
            assert.strictEqual(
              `${e.message}@line:${e.lineNumber},column:${e.column}`,
              output,
            );
            return;
          }
          throw e;
        }
      });

      it("location must be correct.", () => {
        if (!ast) return;
        // check tokens
        checkTokens(ast, input);

        checkLoc(ast, inputFileName, input);
      });

      it("return value of getStaticYAMLValue must be correct.", () => {
        if (!ast) return;
        // check getStaticYAMLValue
        const value = fs.readFileSync(valueFileName, "utf8");
        assert.strictEqual(valueToJson(getStaticYAMLValue(ast)), value);
      });

      if (
        // multiple documents
        !inputFileName.endsWith("/docs01-input.yaml") &&
        !inputFileName.endsWith("/flow01-input.yaml") &&
        !inputFileName.endsWith("/quoted01-input.yaml") &&
        !inputFileName.endsWith("/test01-input.yaml") &&
        // null key
        !inputFileName.endsWith("/comment-and-flow-map01-input.yaml") &&
        !inputFileName.endsWith("/comment-and-flow-map02-input.yaml") &&
        !inputFileName.endsWith("/empty-pair01-input.yaml") &&
        !inputFileName.endsWith("/empty-pair03-input.yaml") &&
        !inputFileName.endsWith("/pair-in-block-map01-input.yaml") &&
        !inputFileName.endsWith("/pair-in-block-map02-input.yaml") &&
        !inputFileName.endsWith("/pair-in-flow-seq01-input.yaml") &&
        !inputFileName.endsWith("/pair-in-flow-seq02-input.yaml") &&
        !inputFileName.endsWith("/pair-in-flow-seq03-input.yaml") &&
        // There are some differences in spec
        !inputFileName.endsWith("/astexplorer-input.yaml")
      ) {
        it("The result of getStaticYAMLValue() and the result of parsing with the yaml package should be the same.", () => {
          assert.deepStrictEqual(
            getStaticYAMLValue(ast),
            normalize(
              YAML.parse(input, {
                logLevel: "silent",
                ...parserOptionsToYAMLOption(parserOptions),
              }),
            ),
          );

          function normalize(value: any): any {
            if (value instanceof Map) {
              return Object.fromEntries(
                [...value].map(([k, v]) => [k, normalize(v)]),
              );
            }
            if (value instanceof Set) {
              return normalize([...value]);
            }
            if (Array.isArray(value)) {
              return value.map(normalize);
            }
            if (value && typeof value === "object") {
              return Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, normalize(v)]),
              );
            }
            return value;
          }
        });
      }

      it("even if Win, it must be correct.", () => {
        if (!ast) return;
        const inputForWin = input.replace(/\n/g, "\r\n");
        // check
        const astForWin = parse(inputForWin, parserOptions, inputFileName);
        // check tokens
        checkTokens(astForWin, inputForWin);
      });
    });
  }
});

describe("yaml-test-suite.", () => {
  for (const fixture of listupFixtures(SUITE_FIXTURE_ROOT)) {
    describe(fixture.filename, () => {
      const {
        input,
        inputFileName,
        parserOptions,
        outputFileName,
        valueFileName,
      } = fixture;

      const output = fs.readFileSync(outputFileName, "utf8");

      let ast: any;
      it("most to generate the expected AST.", () => {
        try {
          ast = parse(input, parserOptions, inputFileName);
        } catch (e: any) {
          if (
            typeof e.lineNumber === "number" &&
            typeof e.column === "number"
          ) {
            assert.strictEqual(
              `${e.message}@line:${e.lineNumber},column:${e.column}`,
              output,
            );
            return;
          }
          throw e;
        }
        const astJson = astToJson(ast);
        assert.strictEqual(astJson, output);
      });

      it("location must be correct.", () => {
        if (!ast) return;

        // check tokens
        checkTokens(ast, input);

        // check keys
        traverseNodes(ast, {
          enterNode(node) {
            const allKeys = KEYS[node.type];
            for (const key of getKeys(node, {})) {
              assert.ok(allKeys.includes(key), `missing '${key}' key`);
            }
          },
          leaveNode() {
            // noop
          },
        });

        checkLoc(ast, inputFileName, input);
      });

      it("return value of getStaticYAMLValue must be correct.", () => {
        if (!ast) return;
        // check getStaticYAMLValue
        const value = fs.readFileSync(valueFileName, "utf8");
        assert.strictEqual(valueToJson(getStaticYAMLValue(ast)), value);
      });

      if (ast) {
        it("The result of getStaticYAMLValue() and the result of parsing with the yaml package should be the same.", () => {
          assert.deepStrictEqual(
            getStaticYAMLValue(ast),
            YAML.parse(input, {
              logLevel: "silent",
              ...parserOptionsToYAMLOption(parserOptions),
            }),
          );
        });
      }
      it("even if Win, it must be correct.", () => {
        if (!ast) return;
        const inputForWin = input.replace(/\n/g, "\r\n");
        // check
        const astForWin = parse(inputForWin, parserOptions, inputFileName);
        // check tokens
        checkTokens(astForWin, inputForWin);

        // const astJson = JSON.stringify(astForWin, replacerForWin, 2)
        // assert.strictEqual(
        //     astJson,
        //     JSON.stringify(JSON.parse(output), replacerForWin, 2),
        // )

        // const value = fs.readFileSync(valueFileName, "utf8")
        // assert.strictEqual(
        //     JSON.stringify(
        //         getStaticYAMLValue(astForWin),
        //         valueReplacer,
        //         2,
        //     ),
        //     value,
        // )
      });
    });
  }
});

function checkTokens(ast: YAMLProgram, input: string) {
  const allTokens = [...ast.tokens, ...ast.comments].sort(
    (a, b) => a.range[0] - b.range[0],
  );

  assert.strictEqual(
    input.replace(/\s/gu, ""),
    allTokens
      .map((t) => (t.type === "Block" ? `#${t.value}` : t.value))
      .join("")
      .replace(/\s/gu, ""),
  );

  // check loc
  for (const token of allTokens) {
    const value = token.type === "Block" ? `#${token.value}` : token.value;

    assert.strictEqual(value, input.slice(...token.range));
  }
}

function checkLoc(ast: YAMLProgram, fileName: string, code: string) {
  for (const token of ast.tokens) {
    assert.ok(
      token.range[0] < token.range[1],
      `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
    );
  }
  for (const token of ast.comments) {
    assert.ok(
      token.range[0] < token.range[1],
      `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
    );
  }
  traverseNodes(ast, {
    enterNode(node, parent) {
      if (node.type !== "Program" && node.type !== "YAMLDocument") {
        assert.ok(
          node.range[0] < node.range[1],
          `No range on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
        );
      }
      if (node.type === "YAMLWithMeta") {
        if (node.anchor && node.value) {
          assert.ok(
            node.anchor.range[1] <= node.value.range[0],
            `overlap range on "${node.anchor.type} endIndex:${node.anchor.range[1]}" and "${node.value.type} startIndex:${node.value.range[0]}" in ${fileName}`,
          );
        }
        if (node.tag && node.value) {
          assert.ok(
            node.tag.range[1] <= node.value.range[0],
            `overlap range on "${node.tag.type} endIndex:${node.tag.range[1]}" and "${node.value.type} startIndex:${node.value.range[0]}" in ${fileName}`,
          );
        }
      } else if (node.type === "YAMLPair") {
        if (node.key) {
          if (code[node.range[0]] !== "?") {
            assert.ok(
              node.key.range[0] === node.range[0],
              `The start position is off on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" > "${node.key.type} line:${node.key.loc.start.line} col:${node.key.loc.start.column}" in ${fileName}`,
            );
          }
        }
        if (node.value) {
          assert.ok(
            node.value.range[1] === node.range[1],
            `The end position is off on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" > "${node.value.type} line:${node.value.loc.end.line} col:${node.value.loc.end.column}" in ${fileName}`,
          );
        }
      } else if (node.type === "YAMLMapping") {
        if (node.style === "block") {
          if (node.pairs.length) {
            assert.ok(
              node.pairs[0].range[0] === node.range[0],
              `The start position is off on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" > "${node.pairs[0].type} line:${node.pairs[0].loc.start.line} col:${node.pairs[0].loc.start.column}" in ${fileName}`,
            );
            const last = node.pairs[node.pairs.length - 1];
            assert.ok(
              last.range[1] === node.range[1],
              `The end position is off on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" > "${last.type} line:${last.loc.end.line} col:${last.loc.end.column}" in ${fileName}`,
            );
          }
        } else if (node.style === "flow") {
          assert.ok(
            code[node.range[0]] === "{",
            `Start position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
          );
          assert.ok(
            code[node.range[1] - 1] === "}",
            `End position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
          );
        }
      } else if (node.type === "YAMLSequence") {
        if (node.style === "block") {
          if (node.entries.length) {
            assert.ok(
              code[node.range[0]] === "-",
              `Start position is not "-" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
            );
            const last = node.entries[node.entries.length - 1];
            if (last)
              assert.ok(
                last.range[1] === node.range[1],
                `The end position is off on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" > "${last.type} line:${last.loc.end.line} col:${last.loc.end.column}" in ${fileName}`,
              );
          }
        } else if (node.style === "flow") {
          assert.ok(
            code[node.range[0]] === "[",
            `Start position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
          );
          assert.ok(
            code[node.range[1] - 1] === "]",
            `End position is not "{" on "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
          );
        }
      } else if (node.type === "YAMLScalar") {
        // TODO
      }
      if (parent) {
        assert.ok(
          parent.range[0] <= node.range[0],
          `overlap range[0] on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
        );
        assert.ok(
          node.range[1] <= parent.range[1],
          `overlap range[1] on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
        );

        assert.ok(
          parent.loc.start.line <= node.loc.start.line,
          `overlap loc.start.line on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
        );
        if (parent.loc.start.line === node.loc.start.line) {
          assert.ok(
            parent.loc.start.column <= node.loc.start.column,
            `overlap loc.start.column on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
          );
        }

        assert.ok(
          node.loc.end.line <= parent.loc.end.line,
          `overlap loc.end.line on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
        );
        if (parent.loc.end.line === node.loc.end.line) {
          assert.ok(
            node.loc.end.column <= parent.loc.end.column,
            `overlap loc.end.column on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
          );
        }
      }
    },
    leaveNode() {
      // noop
    },
  });
}
