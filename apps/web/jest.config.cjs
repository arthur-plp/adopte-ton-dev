// eslint-disable-next-line @typescript-eslint/no-require-imports -- next/jest n'expose qu'un export CommonJS
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  collectCoverageFrom: [
    "lib/**/*.ts",
    "!lib/**/*.spec.ts",
  ],
};

module.exports = createJestConfig(customJestConfig);
