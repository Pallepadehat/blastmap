import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// One place reads the environment (CLAUDE.md).
const PROCESS_ENV = {
  object: "process",
  property: "env",
  message: "Read configuration through env() in src/server/env.ts.",
};

// Host tokens are read only inside host adapters (CLAUDE.md).
const GET_ACCESS_TOKEN = {
  property: "getAccessToken",
  message: "Host tokens are read only inside the host adapters in src/server/hosts.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": ["error", PROCESS_ENV, GET_ACCESS_TOKEN],
    },
  },
  {
    // The parser is standalone: directory in, data out, runnable from a plain
    // script. It can't depend on the app around it (CLAUDE.md).
    files: ["src/parser/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "drizzle-orm", "drizzle-orm/*", "postgres"],
              message: "The parser can't import the framework or the database.",
            },
            {
              group: ["@/*", "**/server/**", "**/app/**", "**/components/**"],
              message: "The parser can't import app code.",
            },
          ],
        },
      ],
    },
  },
  {
    // Every read of analysis data goes through the data-access layer in
    // src/server/mappings, which checks access with the host first (CLAUDE.md).
    files: ["src/**"],
    ignores: ["src/server/mappings/**", "src/parser/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mappings/table", "@/server/mappings/table"],
              message: "Query mappings through the data-access layer in src/server/mappings.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/env.ts"],
    rules: { "no-restricted-properties": ["error", GET_ACCESS_TOKEN] },
  },
  {
    files: ["src/server/hosts/**"],
    rules: { "no-restricted-properties": ["error", PROCESS_ENV] },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
