import path from "path";
import fs from "fs";

import { parseForESLint } from "../src/parser";
import { getStaticYAMLValue } from "../src/utils";
import {
  astToJson,
  listupFixtures,
  valueToJson,
} from "../tests/src/test-utils";

const AST_FIXTURE_ROOT = path.resolve(
  __dirname,
  "../tests/fixtures/parser/ast",
);
const SUITE_FIXTURE_ROOT = path.resolve(
  __dirname,
  "../tests/fixtures/parser/yaml-test-suite",
);

/**
 * Parse
 */
function parse(code: string, parserOptions: any) {
  return parseForESLint(code, parserOptions);
}

for (const fixture of listupFixtures(AST_FIXTURE_ROOT)) {
  const { input, inputFileName, parserOptions, outputFileName, valueFileName } =
    fixture;
  console.log(inputFileName);
  try {
    const ast = parse(input, parserOptions).ast;
    const astJson = astToJson(ast);
    fs.writeFileSync(outputFileName, astJson, "utf8");
    fs.writeFileSync(
      valueFileName,
      valueToJson(getStaticYAMLValue(ast)),
      "utf8",
    );
  } catch (e: any) {
    fs.writeFileSync(
      outputFileName,
      `${e.message}@line:${e.lineNumber},column:${e.column}`,
      "utf8",
    );
  }
}

for (const fixture of listupFixtures(SUITE_FIXTURE_ROOT)) {
  const { input, inputFileName, parserOptions, outputFileName, valueFileName } =
    fixture;
  // eslint-disable-next-line no-console -- update log
  console.log(inputFileName);
  try {
    const ast = parse(input, parserOptions).ast;
    const astJson = astToJson(ast);
    fs.writeFileSync(outputFileName, astJson, "utf8");
    fs.writeFileSync(
      valueFileName,
      valueToJson(getStaticYAMLValue(ast)),
      "utf8",
    );
  } catch (e: any) {
    if (typeof e.lineNumber === "number" && typeof e.column === "number") {
      fs.writeFileSync(
        outputFileName,
        `${e.message}@line:${e.lineNumber},column:${e.column}`,
        "utf8",
      );
    } else {
      throw e;
    }
  }
}
