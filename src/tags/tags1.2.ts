import type { TagResolver } from "./commons"
import { OMAP } from "./omap"
import { SET } from "./set"

export const NULL: TagResolver<null> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:null",
    testString(str) {
        return (
            !str || // empty
            // see https://yaml.org/spec/1.2/spec.html#id2805071
            str === "null" ||
            str === "Null" ||
            str === "NULL" ||
            str === "~"
        )
    },
    resolveString() {
        return null
    },
}
export const TRUE: TagResolver<true> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:bool",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return str === "true" || str === "True" || str === "TRUE"
    },
    resolveString() {
        return true
    },
}
export const FALSE: TagResolver<false> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:bool",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return str === "false" || str === "False" || str === "FALSE"
    },
    resolveString() {
        return false
    },
}
export const INT: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:int",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^[+-]?\d+$/u.test(str)
    },
    resolveString(str) {
        return parseInt(str, 10)
    },
}
export const INT_BASE8: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:int",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^0o[0-7]+$/u.test(str)
    },
    resolveString(str) {
        return parseInt(str.slice(2), 8)
    },
}
export const INT_BASE16: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:int",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^0x[\dA-Fa-f]+$/u.test(str)
    },
    resolveString(str) {
        return parseInt(str.slice(2), 16)
    },
}
export const FLOAT: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:float",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^[+-]?(?:\.\d+|\d+(?:\.\d*)?)(?:[Ee][+-]?\d+)?$/u.test(str)
    },
    resolveString(str) {
        return parseFloat(str)
    },
}
export const INFINITY: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:float",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^[+-]?(?:\.inf|\.Inf|\.INF)$/u.test(str)
    },
    resolveString(str) {
        return str.startsWith("-") ? -Infinity : Infinity
    },
}
export const NAN: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:float",
    testString(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return str === ".NaN" || str === ".nan" || str === ".NAN"
    },
    resolveString() {
        return NaN
    },
}
export const STR: TagResolver<string> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:str",
    testString() {
        return true
    },
    resolveString(str) {
        return str
    },
}

export const tagResolvers = [
    NULL,
    TRUE,
    FALSE,
    INT,
    INT_BASE8,
    INT_BASE16,
    FLOAT,
    INFINITY,
    NAN,
    STR,
]

export const tagNodeResolvers = [OMAP, SET]
