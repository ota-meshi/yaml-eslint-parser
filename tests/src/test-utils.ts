/* global require -- node */
import path from "path";
import fs from "fs";
import semver from "semver";
import type { YAMLContentValue } from "../../src/utils";
import type { YAMLProgram } from "../../src/ast";

export function* listupFixtures(dir: string): IterableIterator<{
  input: string;
  filename: string;
  inputFileName: string;
  outputFileName: string;
  valueFileName: string;
  parserOptions: any;
}> {
  for (const fixture of listupFixturesImpl(dir)) {
    yield {
      ...fixture,
      filename: path.relative(dir, fixture.inputFileName),
    };
  }
}

function* listupFixturesImpl(dir: string): IterableIterator<{
  input: string;
  inputFileName: string;
  outputFileName: string;
  valueFileName: string;
  parserOptions: any;
}> {
  const optionsForDirFileName = path.join(dir, "_options.json");
  const dirParserOptions = fs.existsSync(optionsForDirFileName)
    ? JSON.parse(fs.readFileSync(optionsForDirFileName, "utf-8"))
    : undefined;
  for (const filename of fs.readdirSync(dir)) {
    const inputFileName = path.join(dir, filename);
    if (filename.endsWith("input.yaml")) {
      const optionsFileName = inputFileName.replace(
        /input\.yaml$/u,
        "options.json"
      );
      const parserOptions = fs.existsSync(optionsFileName)
        ? JSON.parse(fs.readFileSync(optionsFileName, "utf-8"))
        : dirParserOptions;
      const outputFileName = inputFileName.replace(
        /input\.yaml$/u,
        "output.json"
      );
      const valueFileName = inputFileName.replace(
        /input\.yaml$/u,
        "value.json"
      );
      const requirementsFileName = inputFileName.replace(
        /input\.yaml$/u,
        "requirements.json"
      );

      const input = fs.readFileSync(inputFileName, "utf8");
      const requirements = fs.existsSync(requirementsFileName)
        ? JSON.parse(fs.readFileSync(requirementsFileName, "utf-8"))
        : {};

      if (
        Object.entries(requirements).some(([pkgName, pkgVersion]) => {
          const pkg: {
            version: string;
            // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- ignore
          } = require(`${pkgName}/package.json`);
          return !semver.satisfies(pkg.version, pkgVersion as string);
        })
      ) {
        continue;
      }
      yield {
        input,
        inputFileName,
        outputFileName,
        valueFileName,
        parserOptions,
      };
    }
    if (
      fs.existsSync(inputFileName) &&
      fs.statSync(inputFileName).isDirectory()
    ) {
      yield* listupFixturesImpl(inputFileName);
    }
  }
}

export function astToJson(ast: YAMLProgram): string {
  return JSON.stringify(ast, replacer, 2);
}

export function valueToJson(value: YAMLContentValue): string {
  return JSON.stringify(value, valueReplacer, 2);
}

/**
 * Remove `parent` properties from the given AST.
 */
function replacer(key: string, value: any) {
  if (key === "parent" || key === "anchors") {
    return undefined;
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return null; // Make it null so it can be checked on node8.
    // return `${String(value)}n`
  }
  return value;
}

//
// Replacer for NaN and infinity
//
function valueReplacer(_key: string, value: any) {
  if (typeof value === "number") {
    if (!isFinite(value)) {
      return `# ${String(value)} #`;
    }
  }
  return value;
}
