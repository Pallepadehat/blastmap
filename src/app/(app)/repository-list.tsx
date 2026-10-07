"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export type RepositoryRow = {
  path: string;
  href: string;
  visibility: string;
  defaultBranch: string | null;
  updated: string;
};

// Filtering is over rows already in the browser, so it's instant: no request,
// no spinner.
export function RepositoryList({ rows }: { rows: RepositoryRow[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.path.toLowerCase().includes(needle)) : rows;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter"
          aria-label="Filter repositories"
          className="h-7 max-w-64 text-xs"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">{rows.length === 0 ? "No repositories." : "Nothing matches."}</p>
      ) : (
        <ul className="flex flex-col border-y">
          {shown.map((r) => (
            <li key={r.path} className="border-b last:border-b-0">
              <Link
                href={r.href}
                className="grid h-7 grid-cols-[1fr_4rem_8rem_4rem] items-center gap-3 px-2 hover:bg-accent"
              >
                <span className="truncate font-mono">{r.path}</span>
                <span className="text-xs text-muted-foreground">{r.visibility}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{r.defaultBranch ?? "empty"}</span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">{r.updated}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
