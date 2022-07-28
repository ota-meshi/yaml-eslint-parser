import type { DocumentOptions } from "yaml"

/**
 * ESLint parserOptions to `yaml`'s Composer options.
 */
export function parserOptionsToYAMLOption(options: any): DocumentOptions {
    if (!options) {
        return {}
    }
    const result: DocumentOptions = {}
    const version = options.defaultYAMLVersion
    if (typeof version === "string" || typeof version === "number") {
        const sVer = String(version)
        if (sVer === "1.2" || sVer === "1.1") {
            result.version = sVer
        } else {
            // Treat unknown versions as next.
            result.version = "next"
        }
    }
    return result
}
