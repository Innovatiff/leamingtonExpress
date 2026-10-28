// ESLint for the Cloud Functions (run by `firebase deploy` before uploading).
const js = require("@eslint/js");
const google = require("eslint-config-google");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...google.rules,
      "quotes": ["error", "double", { allowTemplateLiterals: true }],
      "max-len": ["error", { code: 160, ignoreStrings: true, ignoreTemplateLiterals: true }],
      "object-curly-spacing": ["error", "always"],
      "require-jsdoc": "off",
      "valid-jsdoc": "off",
      "indent": ["error", 2, { SwitchCase: 1 }],
      "operator-linebreak": "off",
    },
  },
];
