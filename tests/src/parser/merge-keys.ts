import assert from "node:assert";
import { parseYAML } from "../../../src/parser.ts";
import { getStaticYAMLValue } from "../../../src/utils.ts";

/**
 * Parse the given code and return the static value of the whole program.
 */
function staticValue(code: string): unknown {
  return getStaticYAMLValue(parseYAML(code));
}

describe("getStaticYAMLValue with merge keys (`<<`)", () => {
  it("merges a single mapping alias in YAML 1.1", () => {
    const value = staticValue(`%YAML 1.1
---
base: &base
  a: 1
  b: 2
derived:
  <<: *base
  b: 3
`);
    assert.deepStrictEqual(value, {
      base: { a: 1, b: 2 },
      derived: { a: 1, b: 3 },
    });
  });

  it("lets keys defined before the merge key win", () => {
    const value = staticValue(`%YAML 1.1
---
base: &base
  a: 1
  b: 2
derived:
  b: 3
  <<: *base
`);
    assert.deepStrictEqual(value, {
      base: { a: 1, b: 2 },
      derived: { b: 3, a: 1 },
    });
  });

  it("merges a sequence of aliases, earlier winning over later", () => {
    const value = staticValue(`%YAML 1.1
---
a: &a
  p: 1
  q: 1
b: &b
  q: 2
  r: 2
derived:
  <<: [*a, *b]
`);
    assert.deepStrictEqual(value, {
      a: { p: 1, q: 1 },
      b: { q: 2, r: 2 },
      derived: { p: 1, q: 1, r: 2 },
    });
  });

  it("keeps `<<` as a literal key in YAML 1.2", () => {
    const value = staticValue(`%YAML 1.2
---
base: &base
  a: 1
derived:
  <<: *base
`);
    assert.deepStrictEqual(value, {
      base: { a: 1 },
      derived: { "<<": { a: 1 } },
    });
  });

  it("treats a quoted `<<` as a literal key even in YAML 1.1", () => {
    const value = staticValue(`%YAML 1.1
---
"<<": 1
a: 2
`);
    assert.deepStrictEqual(value, { "<<": 1, a: 2 });
  });
});
