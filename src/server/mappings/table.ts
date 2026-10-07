import { index, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { ParseResult } from "@/parser";
import { user } from "../db/schema";

// Analysis data. Kept out of the schema the database client is built with, and
// lint stops anything outside src/server/mappings importing it, so every read
// goes through the access gate in this directory (CLAUDE.md).

export const MAPPING_STATUSES = [
  "queued",
  "downloading",
  "unpacking",
  "parsing",
  "saving",
  "done",
  "failed",
] as const;

export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export type MappingProgress =
  | { step: "downloading"; bytes: number; totalBytes: number | null }
  | { step: "parsing"; total: number; read: number; resolved: number };

// One mapping per repository and commit, shared by everyone who can read the
// repository on its host.
export const mapping = pgTable(
  "mapping",
  {
    id: text("id").primaryKey(),
    host: text("host").notNull(),
    // The host's canonical path, so case differences in a URL map to one row.
    repoPath: text("repo_path").notNull(),
    commit: text("commit").notNull(),
    // The branch it was mapped from; a commit can be on several.
    branch: text("branch").notNull(),
    status: text("status", { enum: MAPPING_STATUSES }).notNull(),
    progress: jsonb("progress").$type<MappingProgress>(),
    error: text("error"),
    result: jsonb("result").$type<ParseResult>(),
    startedBy: text("started_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [
    unique("mapping_repository_commit").on(t.host, t.repoPath, t.commit),
    index("mapping_repository_created_idx").on(t.host, t.repoPath, t.createdAt),
  ],
);
