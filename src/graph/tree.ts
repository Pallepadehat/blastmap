// The folder tree the map folds and unfolds.

export type Folder = {
  // "" for the root. Otherwise the full path, e.g. "src/server/db".
  path: string;
  // Relative to the parent folder. A chain of folders with one child each is
  // one node, labelled with the whole chain: "server/db".
  label: string;
  parent: Folder | null;
  folders: Folder[];
  files: string[];
  // Files anywhere underneath.
  total: number;
};

export function buildTree(paths: string[]): { root: Folder; byPath: Map<string, Folder> } {
  const root: Folder = { path: "", label: "", parent: null, folders: [], files: [], total: 0 };
  const raw = new Map<string, Folder>([["", root]]);

  const folderAt = (dir: string): Folder => {
    const known = raw.get(dir);
    if (known) return known;
    const slash = dir.lastIndexOf("/");
    const parent = folderAt(slash === -1 ? "" : dir.slice(0, slash));
    const folder: Folder = { path: dir, label: dir.slice(slash + 1), parent, folders: [], files: [], total: 0 };
    parent.folders.push(folder);
    raw.set(dir, folder);
    return folder;
  };

  for (const p of paths) {
    const slash = p.lastIndexOf("/");
    folderAt(slash === -1 ? "" : p.slice(0, slash)).files.push(p);
  }

  compress(root);
  count(root);
  sort(root);

  const byPath = new Map<string, Folder>();
  const index = (f: Folder) => {
    byPath.set(f.path, f);
    f.folders.forEach(index);
  };
  index(root);
  return { root, byPath };
}

// Merges each folder that holds nothing but one subfolder into that subfolder.
function compress(folder: Folder) {
  folder.folders = folder.folders.map((child) => {
    let node = child;
    for (let only = onlySubfolder(node); only; only = onlySubfolder(node)) {
      node = { ...only, label: `${node.label}/${only.label}`, parent: folder };
    }
    node.parent = folder;
    for (const grandchild of node.folders) grandchild.parent = node;
    compress(node);
    return node;
  });
}

function onlySubfolder(folder: Folder): Folder | undefined {
  return folder.files.length === 0 && folder.folders.length === 1 ? folder.folders[0] : undefined;
}

function count(folder: Folder): number {
  folder.total = folder.files.length + folder.folders.reduce((n, f) => n + count(f), 0);
  return folder.total;
}

function sort(folder: Folder) {
  folder.folders.sort((a, b) => (a.path < b.path ? -1 : 1));
  folder.files.sort();
  folder.folders.forEach(sort);
}

// The folders between the root and a file, outermost first: what has to be
// open for the file itself to be on the canvas.
export function foldersAbove(file: string, byPath: Map<string, Folder>): Folder[] {
  const chain: Folder[] = [];
  for (let dir = file; dir.includes("/"); ) {
    dir = dir.slice(0, dir.lastIndexOf("/"));
    const folder = byPath.get(dir);
    if (folder) chain.unshift(folder);
  }
  return chain;
}

export const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
