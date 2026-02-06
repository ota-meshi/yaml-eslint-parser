import myPlugin from "@ota-meshi/eslint-plugin";
import n from "eslint-plugin-n";

export default [
  {
    ignores: [
      ".nyc_output",
      "coverage",
      "lib",
      "node_modules",
      "explorer/dist",
      "explorer/node_modules",
      "tests/fixtures/**/*.json",
      "!tests/fixtures/**/*options.json",
    ],
  },
  ...myPlugin.config({
    node: true,
    ts: true,
    json: true,
    packageJson: true,
    prettier: true,
  }),
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },

    rules: {
      "no-warning-comments": "warn",
      "no-lonely-if": "off",
      "one-var": "off",
    },
  },
  {
    files: ["**/*.{js,ts,mjc,mts,cjs,cts}"],
    plugins: { n },
    rules: {
      "n/prefer-node-protocol": "error",
      "n/file-extension-in-import": ["error", "always"],
    },
    settings: {
      n: {
        typescriptExtensionMap: [],
      },
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "spaced-comment": "off",
    },
  },
  {
    files: ["**/*.ts"],

    languageOptions: {
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "property",
          format: null,
        },
        {
          selector: "method",
          format: null,
        },
        {
          selector: "import",
          format: null,
        },
      ],

      "no-implicit-globals": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-invalid-this": "off",
      "@typescript-eslint/no-invalid-this": "error",
    },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],

    rules: {
      "no-console": "off",
    },
  },
];
