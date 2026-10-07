import fs from "node:fs";
import { isInside } from "./paths.ts";

// Read-only file access confined to the parsed directory. TypeScript's module
// resolution and config parsing both run on this, so neither can reach outside
// the directory or into node_modules.
export type Host = {
  fileExists(abs: string): boolean;
  directoryExists(abs: string): boolean;
  readFile(abs: string): string | undefined;
};

export function createHost(root: string): Host {
  const stat = (abs: string) => (isInside(root, abs) ? fs.statSync(abs, { throwIfNoEntry: false }) : undefined);
  return {
    fileExists: (abs) => stat(abs)?.isFile() ?? false,
    directoryExists: (abs) => stat(abs)?.isDirectory() ?? false,
    readFile: (abs) => (stat(abs)?.isFile() ? fs.readFileSync(abs, "utf8") : undefined),
  };
}
