module.exports = {
    root: true,
    parserOptions: {
        sourceType: "module",
        ecmaVersion: 2020,
    },
    extends: [
        "plugin:@ota-meshi/+vue3",
        "plugin:@ota-meshi/+prettier",
        "plugin:@ota-meshi/+json",
    ],
    rules: {
        "node/no-unsupported-features/es-syntax": "off",
    },
}
