const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Playwright e2e specs live under e2e/ and run via `yarn test:e2e`,
  // not jest.
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
};

module.exports = createJestConfig(customConfig);
