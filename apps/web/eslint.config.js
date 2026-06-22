import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["coverage/**"] },
  ...nextJsConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "no-undef": "off",
    },
  },
];
