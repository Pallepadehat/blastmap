import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // One place reads the environment (CLAUDE.md).
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Read configuration through env() in src/server/env.ts." },
      ],
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
    files: ["src/server/env.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
