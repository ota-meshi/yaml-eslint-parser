import type { TagResolver } from "./commons"
import * as Tags1_2 from "./tags1.2"

// https://yaml.org/type/

// see https://yaml.org/type/null.html
export const NULL: TagResolver<null> = Tags1_2.NULL
export const TRUE: TagResolver<true> = {
    // see https://yaml.org/type/bool.html
    tag: "tag:yaml.org,2002:bool",
    test(str) {
        // see https://yaml.org/type/bool.html
        return /^(y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON)$/u.test(str)
    },
    resolve() {
        return true
    },
}
export const FALSE: TagResolver<false> = {
    // see https://yaml.org/type/bool.html
    tag: "tag:yaml.org,2002:bool",
    test(str) {
        // see https://yaml.org/type/bool.html
        return /^(n|N|no|No|NO|false|False|FALSE|off|Off|OFF)$/u.test(str)
    },
    resolve() {
        return false
    },
}
export const INT: TagResolver<number> = {
    // see https://yaml.org/type/int.html
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/type/int.html
        return /^[-+]?(0|[1-9][\d_]*)$/u.test(str)
    },
    resolve(str) {
        return resolveInt(str, 0, 10)
    },
}
export const INT_BASE2: TagResolver<number> = {
    // see https://yaml.org/type/int.html
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/type/int.html
        return /^[-+]?0b[0-1_]+$/u.test(str)
    },
    resolve(str) {
        return resolveInt(str, 2, 2)
    },
}
export const INT_BASE8: TagResolver<number> = {
    // see https://yaml.org/type/int.html
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/type/int.html
        return /^[-+]?0[0-7_]+$/u.test(str)
    },
    resolve(str) {
        return resolveInt(str, 1, 8)
    },
}
export const INT_BASE16: TagResolver<number> = {
    // see https://yaml.org/type/int.html
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/type/int.html
        return /^[-+]?0x[\da-fA-F_]+$/u.test(str)
    },
    resolve(str) {
        return resolveInt(str, 2, 16)
    },
}
export const FLOAT: TagResolver<number> = {
    // see https://yaml.org/type/float.html
    tag: "tag:yaml.org,2002:float",
    test(str) {
        // see https://yaml.org/type/float.html
        return (
            /^[-+]?(\d[\d_]*)?\.[\d_]*([eE][-+]\d+)?$/u.test(str) ||
            // The previous regexp cannot handle "e" without dot. spec bug?
            /^[-+]?(\d[\d_]*)?([eE][-+]\d+)?$/u.test(str)
        )
    },
    resolve(str) {
        return parseFloat(str.replace(/_/gu, ""))
    },
}
// see https://yaml.org/type/float.html
export const INFINITY: TagResolver<number> = Tags1_2.INFINITY
// see https://yaml.org/type/float.html
export const NAN: TagResolver<number> = Tags1_2.NAN
// see https://yaml.org/type/str.html
export const STR: TagResolver<string> = Tags1_2.STR

// !!Base 60 numbers are not supported
// see https://yaml.org/type/int.html, https://yaml.org/type/float.html

export const tagResolvers = [
    NULL,
    TRUE,
    FALSE,
    INT_BASE8,
    INT,
    INT_BASE2,
    INT_BASE16,
    FLOAT,
    INFINITY,
    NAN,
    STR,
]

/**
 * Resolve int value
 */
function resolveInt(value: string, skip: number, radix: number) {
    if ((skip > 0 && value.startsWith("-")) || value.startsWith("+")) {
        return parseInt(
            value[0] + value.slice(skip + 1).replace(/_/gu, ""),
            radix,
        )
    }
    return parseInt(value.slice(skip).replace(/_/gu, ""), radix)
}
