export type HostId = "github" | "gitlab";

export type Visibility = "public" | "internal" | "private";

export type Repository = {
  host: HostId;
  // `owner/name` on GitHub; the full namespace path on GitLab.
  path: string;
  visibility: Visibility;
  // Null for an empty repository.
  defaultBranch: string | null;
  updatedAt: Date;
  webUrl: string;
  // As the host reports it. GitHub counts the whole git history; GitLab only
  // reports it to members with Reporter access or above, otherwise null.
  sizeBytes: number | null;
};

export type Branch = { name: string; commit: string };

export type Archive = {
  // A gzipped tarball of the repository at one commit, with every path under a
  // single top-level directory.
  body: ReadableStream<Uint8Array>;
  // From Content-Length, when the host sends it.
  length: number | null;
};

// The signed-in user's identity on one host: better-auth's account row.
export type HostAccount = { userId: string; accountId: string };

// Every host is reached through this interface, always as the signed-in user.
export type HostAdapter = {
  id: HostId;
  label: string;
  // Repositories the user can read, most recently active first, at most 100.
  listRepositories(account: HostAccount): Promise<Repository[]>;
  // The repository if the host says this user can read its code, otherwise
  // null. "Doesn't exist" and "can't read" are deliberately the same answer.
  readableRepository(account: HostAccount, path: string): Promise<Repository | null>;
  // Up to 100 branches, the default branch first.
  listBranches(account: HostAccount, repo: Repository): Promise<Branch[]>;
  // The commit a branch points at right now, or null if there's no such branch.
  branchCommit(account: HostAccount, path: string, branch: string): Promise<string | null>;
  // The repository at an exact commit, streamed as the host sends it.
  archive(account: HostAccount, path: string, commit: string): Promise<Archive>;
};

// The host rejected the user's token (revoked, expired, unrefreshable). The
// only useful response is to sign in again.
export class HostAuthError extends Error {
  readonly host: HostId;
  constructor(host: HostId, message: string) {
    super(message);
    this.name = "HostAuthError";
    this.host = host;
  }
}

// Any other failed host call. The message names what was requested and what
// came back, and never contains a token.
export class HostRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostRequestError";
  }
}
