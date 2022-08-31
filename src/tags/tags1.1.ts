import type { TagResolver } from "./commons";
import { OMAP } from "./omap";
import { SET } from "./set";
import * as Tags1_2 from "./tags1.2";

// https://yaml.org/type/

// see https://yaml.org/type/null.html
export const NULL: TagResolver<null> = Tags1_2.NULL;
export const TRUE: TagResolver<true> = {
  // see https://yaml.org/type/bool.html
  tag: "tag:yaml.org,2002:bool",
  testString(str) {
    // see https://yaml.org/type/bool.html
    return /^(?:y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON)$/u.test(str);
  },
  resolveString() {
    return true;
  },
};
export const FALSE: TagResolver<false> = {
  // see https://yaml.org/type/bool.html
  tag: "tag:yaml.org,2002:bool",
  testString(str) {
    // see https://yaml.org/type/bool.html
    return /^(?:n|N|no|No|NO|false|False|FALSE|off|Off|OFF)$/u.test(str);
  },
  resolveString() {
    return false;
  },
};
export const INT: TagResolver<number> = {
  // see https://yaml.org/type/int.html
  tag: "tag:yaml.org,2002:int",
  testString(str) {
    // see https://yaml.org/type/int.html
    return /^[+-]?(?:0|[1-9][\d_]*)$/u.test(str);
  },
  resolveString(str) {
    return resolveInt(str, 0, 10);
  },
};
export const INT_BASE2: TagResolver<number> = {
  // see https://yaml.org/type/int.html
  tag: "tag:yaml.org,2002:int",
  testString(str) {
    // see https://yaml.org/type/int.html
    return /^[+-]?0b[01_]+$/u.test(str);
  },
  resolveString(str) {
    return resolveInt(str, 2, 2);
  },
};
export const INT_BASE8: TagResolver<number> = {
  // see https://yaml.org/type/int.html
  tag: "tag:yaml.org,2002:int",
  testString(str) {
    // see https://yaml.org/type/int.html
    return /^[+-]?0[0-7_]+$/u.test(str);
  },
  resolveString(str) {
    return resolveInt(str, 1, 8);
  },
};
export const INT_BASE16: TagResolver<number> = {
  // see https://yaml.org/type/int.html
  tag: "tag:yaml.org,2002:int",
  testString(str) {
    // see https://yaml.org/type/int.html
    return /^[+-]?0x[\dA-F_a-f]+$/u.test(str);
  },
  resolveString(str) {
    return resolveInt(str, 2, 16);
  },
};
export const INT_BASE60: TagResolver<number> = {
  // see https://yaml.org/type/int.html
  tag: "tag:yaml.org,2002:int",
  testString(str) {
    // see https://yaml.org/type/int.html
    return /^[+-]?[1-9][\d_]*(?::[0-5]?\d)+$/u.test(str);
  },
  resolveString(str) {
    return resolveBase60(str.split(/:/u), true);
  },
};
export const FLOAT: TagResolver<number> = {
  // see https://yaml.org/type/float.html
  tag: "tag:yaml.org,2002:float",
  testString(str) {
    // see https://yaml.org/type/float.html
    return (
      /^[+-]?(?:\d[\d_]*)?\.[\d_]*(?:[Ee][+-]\d+)?$/u.test(str) ||
      // The previous regexp cannot handle "e" without dot. spec bug?
      /^[+-]?(?:\d[\d_]*)?(?:[Ee][+-]\d+)?$/u.test(str)
    );
  },
  resolveString(str) {
    return parseFloat(str.replace(/_/gu, ""));
  },
};
export const FLOAT_BASE60: TagResolver<number> = {
  // see https://yaml.org/type/float.html
  tag: "tag:yaml.org,2002:float",
  testString(str) {
    // see https://yaml.org/type/float.html
    return /^[+-]?\d[\d_]*(?::[0-5]?\d)+\.[\d_]*$/u.test(str);
  },
  resolveString(str) {
    return resolveBase60(str.split(/:/u), false);
  },
};
// see https://yaml.org/type/float.html
export const INFINITY: TagResolver<number> = Tags1_2.INFINITY;
// see https://yaml.org/type/float.html
export const NAN: TagResolver<number> = Tags1_2.NAN;
// see https://yaml.org/type/str.html
export const STR: TagResolver<string> = Tags1_2.STR;

// !!Currently, timestamps are not supported as they affect the type definition.
// If the user needs timestamps, we will consider supporting it in the major version.
// https://yaml.org/type/timestamp.html

export const tagResolvers = [
  NULL,
  TRUE,
  FALSE,
  INT_BASE8,
  INT,
  INT_BASE2,
  INT_BASE16,
  INT_BASE60,
  FLOAT,
  FLOAT_BASE60,
  INFINITY,
  NAN,
  STR,
];

export const tagNodeResolvers = [OMAP, SET];

/**
 * Resolve int value
 */
function resolveInt(value: string, skip: number, radix: number) {
  if ((skip > 0 && value.startsWith("-")) || value.startsWith("+")) {
    return parseInt(value[0] + value.slice(skip + 1).replace(/_/gu, ""), radix);
  }
  return parseInt(value.slice(skip).replace(/_/gu, ""), radix);
}

/**
 * Resolve base 60 number value
 */
function resolveBase60(values: string[], isInt: boolean) {
  let first = values.shift()!.replace(/_/gu, "");
  const last = values.pop()!.replace(/_/gu, "");
  let minus = false;
  if (first.startsWith("-") || first.startsWith("+")) {
    minus = first.startsWith("-");
    first = first.slice(1);
  }
  let value = parseInt(first, 10);
  while (values.length) {
    value *= 60;
    value += parseInt(values.shift()!.replace(/_/gu, ""), 10);
  }
  value *= 60;
  value += isInt ? parseInt(last, 10) : parseFloat(last);
  return minus ? -value : value;
}
