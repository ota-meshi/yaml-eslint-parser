import type { DocumentOptions, ParseOptions } from "yaml";

/**
 * ESLint parserOptions to `yaml`'s Composer options.
 */
export function parserOptionsToYAMLOption(options: any): DocumentOptions & ParseOptions {
  if (!options) {
    return {};
  }
  const result: DocumentOptions & ParseOptions = {};
  const version = options.defaultYAMLVersion;

  const fwd = ["uniqueKeys", "strict"] as const;

  for(let opt of fwd)
    if(opt in options)
      result[opt] = options[opt];

  if (typeof version === "string" || typeof version === "number") {
    const sVer = String(version);
    if (sVer === "1.2" || sVer === "1.1") {
      result.version = sVer;
    } else {
      // Treat unknown versions as next.
      result.version = "next";
    }
  }
  return result;
}
