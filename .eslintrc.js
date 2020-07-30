"use strict"

// const version = require("./package.json").version

module.exports = {
    parserOptions: {
        sourceType: "script",
        ecmaVersion: 2020,
    },
    extends: ["plugin:@mysticatea/es2015", "plugin:@mysticatea/+node"],
    rules: {
        "require-jsdoc": "error",
        "no-warning-comments": "warn",
        "no-lonely-if": "off",
        "@mysticatea/ts/ban-ts-ignore": "off",
    },
    overrides: [
        {
            files: ["*.ts"],
            rules: {
                "@mysticatea/node/no-missing-import": "off",
                "no-implicit-globals": "off",
                "@mysticatea/node/no-extraneous-import": "off",
            },
            parserOptions: {
                sourceType: "module",
                project: "./tsconfig.json",
            },
        },
        {
            files: ["scripts/**/*.ts", "tests/**/*.ts"],
            rules: {
                "require-jsdoc": "off",
                "no-console": "off",
            },
        },
    ],
}
