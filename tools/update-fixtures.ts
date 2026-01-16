import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import yamlTestSuite from "yaml-test-suite";

import { parseForESLint } from "../src/parser";
import { getStaticYAMLValue } from "../src/utils";
import {
  astToJson,
  listupFixtures,
  valueToJson,
} from "../tests/src/test-utils";

// eslint-disable-next-line @typescript-eslint/naming-convention -- standard Node.js convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention -- standard Node.js convention
const __dirname = path.dirname(__filename);
const AST_FIXTURE_ROOT = path.resolve(
  __dirname,
  "../tests/fixtures/parser/ast",
);
const SUITE_FIXTURE_ROOT = path.resolve(
  __dirname,
  "../tests/fixtures/parser/yaml-test-suite",
);

const ONLY = ""; // e.g., "2G84-3-input"

/**
 * Parse
 */
function parse(code: string, parserOptions: any) {
  return parseForESLint(code, parserOptions);
}

for (const fixture of listupFixtures(AST_FIXTURE_ROOT)) {
  const { input, inputFileName, parserOptions, outputFileName, valueFileName } =
    fixture;
  if (ONLY && !inputFileName.includes(ONLY)) continue;
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
    fs.writeFileSync(
      outputFileName,
      `${e.message}@line:${e.lineNumber},column:${e.column}`,
      "utf8",
    );
  }
}

if (!ONLY) {
  fs.rmSync(SUITE_FIXTURE_ROOT, { force: true, recursive: true });
  fs.mkdirSync(SUITE_FIXTURE_ROOT, { recursive: true });
}
for (const { id, cases } of yamlTestSuite) {
  for (const [index, testCase] of cases.entries()) {
    const basename = `${id}${index === 0 ? "" : `-${index + 1}`}`;
    const inputFileName = `${basename}-input.yaml`;
    fs.writeFileSync(
      path.join(SUITE_FIXTURE_ROOT, inputFileName),
      testCase.yaml,
    );
  }
}

for (const fixture of listupFixtures(SUITE_FIXTURE_ROOT)) {
  const { input, inputFileName, parserOptions, outputFileName, valueFileName } =
    fixture;
  if (ONLY && !inputFileName.includes(ONLY)) continue;
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
