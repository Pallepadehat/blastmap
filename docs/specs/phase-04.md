# Phase 04 — The shell and the map

A finished mapping becomes a map: folders as boxes, imports as lines, folders
opening into files, a selected file showing what it imports, what imports it,
and what breaks two levels out. This phase also settles the shell, meaning
where each panel sits and what it's for. Later phases add to these panels and
never rearrange them.

## The shell

Every signed-in page shares one frame:

- **Top bar.** Blastmap, then where you are (repository, then branch and
  short commit when a mapping is open), then on the right the theme control
  and your user menu with sign-out.
- **Left panel: what's in the map.** For now, the map's folders as a tree you
  can open and close, kept in step with the canvas. Later phases add file
  kinds here.
- **Centre: the canvas.**
- **Right panel: the selection.** An overview of the repository when nothing
  is selected, otherwise the selected folder or file. It has tabs, of which
  this phase builds one (Overview). The chat panel arrives later as a second
  tab.

Pages that aren't a map (the repository list, the repository page with its
branch picker and mappings) keep the top bar and use the space below it as
they do now.

### Theme

- Three states: follow the system, light, dark. The choice survives a reload
  and renders correctly on first paint, with no flash of the wrong theme.
- Two real palettes, not one inverted: near-white surfaces in light, near-black
  in dark. Blue for selection and anything interactive, green for incoming,
  amber for outgoing, red only for errors. Everything else is greyscale.

## The map

Opening a finished mapping shows the map. Its coverage report stays one click
away.

- **Boxes are folders.** Each box shows its path and how many files it holds.
  A chain of folders with only one child each (`src/server/db`) becomes one
  box labelled with the whole chain.
- **The first view fits.** It shows at most 60 boxes. Starting from the
  root, it opens the folders that hold the most files first, and stops before
  opening one would take it past 60. Small repositories open all the way down
  to files.
- **Lines are imports.** A line between two boxes means at least one file in
  one imports a file in the other. Each line shows its count. Lines come only
  from the parser's edges; nothing is drawn that the parser didn't resolve.
- **Opening and closing.** Clicking a folder box opens it in place into its
  subfolders and files. Its control closes it again. The layout is
  recalculated for the new set of boxes, and nothing animates.
- **Selecting a file.** The file's incoming lines turn green and its outgoing
  lines amber. Everything not connected to it fades. The right panel shows:
  - its path, in monospace, with a link to it on the host at the mapped commit
  - imports: the files it imports, and how many
  - imported by: the files that import it, and how many
  - blast radius: every file that imports it, directly or through one more
    file, grouped by distance (1 and 2), with counts
  - its unresolved imports, if any, with their reasons
- **Selecting a folder** shows its file count and the lines into and out of
  it, by the folder at the other end.
- **Nothing selected.** The right panel shows the repository overview: files,
  imports and edges, and the 10 most imported files.
- **Instant.** Selecting, opening, closing and the blast radius are all
  arithmetic in the browser over data it already has. No request, no spinner.
- **Links.** A selected file is in the URL. Opening that URL opens the map with
  the file selected and its folders opened.
- **Partial graphs say so.** If any import that should land in the repository
  didn't resolve, a line above the canvas says "Graph is partial: N of M
  imports into this repository resolved". It links to the coverage report.
- **Nothing moves on its own.** No animated layout, no animated lines, and no
  automatic zooming after the first fit. Panning and zooming happen only when
  you do them.

## Acceptance check

1. Open a finished mapping of a small repository. Every folder is visible,
   opened down to files, and the lines match what the coverage report counts.
2. Open a finished mapping of tRPC. At most 60 boxes, a readable layout, and
   the biggest folders opened first.
3. Click a folder: it opens into its contents. Close it: back as it was.
   Nothing animates.
4. Click a file. Green lines in, amber lines out, the rest faded. Check its
   imports and importers against the file on GitHub.
5. Its blast radius lists distance 1 and distance 2 separately. Spot-check one
   distance-2 file by following the two imports by hand.
6. Copy the URL, open it in a new tab: same file selected, its folders open.
   The host link opens the file at the mapped commit.
7. For a repository with unresolved imports, the "Graph is partial" line shows
   and links to the coverage report.
8. Switch between system, light and dark, then reload. The choice holds, with
   no flash. Both palettes look deliberate.
9. Make every interaction above with the network tab open. Nothing after the
   page load makes a request.
