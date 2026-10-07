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
    files: ["src/server/env.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
