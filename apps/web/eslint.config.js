import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "turbo/no-undeclared-env-vars": "off",
      "no-undef": "off",
    },
  },
];
