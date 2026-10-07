import fs from "node:fs";
import path from "node:path";
import { isSourcePath, toRelative } from "./paths.ts";

const NEVER_WALKED = new Set(["node_modules", ".git"]);

export type WalkedFile = { rel: string; abs: string; size: number; symlink: boolean };

export type Walked = { files: WalkedFile[]; symlinkedDirectories: string[] };

export function walk(root: string): Walked {
  const files: WalkedFile[] = [];
  const symlinkedDirectories: string[] = [];

  const visit = (dir: string) => {
    // Byte order, not locale order, so output is identical on every machine.
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!NEVER_WALKED.has(entry.name)) visit(abs);
      } else if (entry.isSymbolicLink()) {
        if (isSourcePath(abs)) {
          files.push({ rel: toRelative(root, abs), abs, size: 0, symlink: true });
        } else if (isDirectory(abs)) {
          symlinkedDirectories.push(toRelative(root, abs));
        }
      } else if (entry.isFile() && isSourcePath(abs)) {
        files.push({ rel: toRelative(root, abs), abs, size: fs.statSync(abs).size, symlink: false });
      }
    }
  };

  visit(root);
  return { files, symlinkedDirectories };
}

function isDirectory(abs: string): boolean {
  try {
    return fs.statSync(abs).isDirectory();
  } catch {
    return false; // a broken link points at nothing
  }
}
