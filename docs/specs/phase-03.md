# Phase 03 — Mapping a repository

Pick a branch, press Map, watch it happen, get the coverage report. This
connects the host adapters to the parser and stores the result. It also builds
the one gate every read of an analysis goes through. No map drawing yet; that's
the next phase, built on what this one stores.

## What it does

### Starting a mapping

- The repository page gets a branch picker, listing up to 100 branches with
  the default first and preselected, and a Map button.
- Mapping is per commit. Map resolves the branch to its current commit. If
  that commit has already been mapped, by you or anyone else, the result opens
  at once with nothing downloaded.
- Anyone who can read the repository on its host can map it and see its
  mappings. Nobody else can.
- The repository page lists that repository's most recent mappings (at most
  20), with branch, short commit, when, and status. Each opens its result.

### Running it

- Before downloading, the repository's size as the host reports it is checked
  against a fixed limit of 500 MB. Over the limit, the mapping is refused with
  both numbers in the message. The download stops and fails the same way if it
  runs past the limit anyway.
- The archive comes from the host's API at that exact commit, as the user who
  started it. It's unpacked to a temporary directory, parsed with the phase 01
  parser, and the directory is deleted afterwards, whether or not it
  succeeded.
- One mapping runs at a time per instance. Others wait in order and show as
  queued.
- Progress moves through queued, downloading (bytes so far), unpacking,
  parsing (files done of total), saving, then done or failed. Each step is
  written to the mapping as it happens and pushed to the page live. Nobody
  polls.
- Reloading, or opening the mapping in another tab, shows the current step
  and carries on live from there.
- A failure says which step failed and why, in the same form as host errors:
  what was requested and what came back.
- If the server restarts mid-mapping, that mapping shows as failed,
  "interrupted by a restart", and can be started again.

### The result

- A finished mapping shows its coverage report: files found, parsed and
  skipped; imports resolved, external and unresolved, each broken down by
  reason; workspace packages; and config problems. Every skipped file and
  every unresolved import is listed with its reason. File paths are
  monospace.
- A mapping has its own address (the repository's address plus the commit),
  so it can be linked to.

### Access

- Every read of mapping data goes through one gate. It asks the host, as the
  signed-in user, whether they can read the repository. The answer is
  remembered per user and repository for 5 minutes, never longer.
- If the answer is no, the server returns "not found", with no partial data,
  for the page, the live progress stream, and anything else that touches
  mapping data.

## Acceptance check

1. Open a small public repository. The default branch is preselected. Press
   Map and watch it move through each step live, ending on the coverage
   report.
2. Map something bigger and reload during parsing. The page comes back at the
   current step and keeps going.
3. Press Map again on the same branch. The result opens instantly. Sign in as
   another user who can read it and open the same mapping: same result,
   nothing downloaded.
4. Switch to another branch and map it. It's a separate mapping with its own
   commit, and both are listed.
5. Try a repository far over the limit, e.g. `torvalds/linux`. It's refused
   before downloading, and the message gives the limit and the repository's
   size.
6. Compare the coverage numbers with `pnpm parse` on a clone of the same
   commit. They match.
7. As a user who can't read a private GitLab project, open a mapping address
   for it, and its live progress address. Both are not found, and the network
   responses contain no mapping data.
8. Stop the server during a mapping and start it again. That mapping shows
   "interrupted by a restart" and can be mapped again.
9. After mappings finish or fail, the temporary directory has nothing left
   behind from them.
