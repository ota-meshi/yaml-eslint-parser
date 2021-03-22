export type TagResolver<T> = {
    tag: string
    test: (str: string) => boolean
    resolve: (str: string) => T
}

export const NULL: TagResolver<null> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:null",
    test(str) {
        return (
            !str || // empty
            // see https://yaml.org/spec/1.2/spec.html#id2805071
            str === "null" ||
            str === "Null" ||
            str === "NULL" ||
            str === "~"
        )
    },
    resolve() {
        return null
    },
}
export const TRUE: TagResolver<true> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:bool",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return str === "true" || str === "True" || str === "TRUE"
    },
    resolve() {
        return true
    },
}
export const FALSE: TagResolver<false> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:bool",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return str === "false" || str === "False" || str === "FALSE"
    },
    resolve() {
        return false
    },
}
export const INT: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^[+-]?\d+$/u.test(str)
    },
    resolve(str) {
        return parseInt(str, 10)
    },
}
export const INT_BASE8: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^0o[0-7]+$/u.test(str)
    },
    resolve(str) {
        return parseInt(str.slice(2), 8)
    },
}
export const INT_BASE16: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:int",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^0x[\dA-Fa-f]+$/u.test(str)
    },
    resolve(str) {
        return parseInt(str.slice(2), 16)
    },
}
export const FLOAT: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:float",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^[+-]?(?:\.\d+|\d+(?:\.\d*)?)(?:[Ee][+-]?\d+)?$/u.test(str)
    },
    resolve(str) {
        return parseFloat(str)
    },
}
export const INFINITY: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:float",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return /^[+-]?(?:\.inf|\.Inf|\.INF)$/u.test(str)
    },
    resolve(str) {
        return str.startsWith("-") ? -Infinity : Infinity
    },
}
export const NAN: TagResolver<number> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:float",
    test(str) {
        // see https://yaml.org/spec/1.2/spec.html#id2805071
        return str === ".NaN" || str === ".nan" || str === ".NAN"
    },
    resolve() {
        return NaN
    },
}
export const STR: TagResolver<string> = {
    // see https://yaml.org/spec/1.2/spec.html#id2803311
    tag: "tag:yaml.org,2002:str",
    test() {
        return true
    },
    resolve(str) {
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
