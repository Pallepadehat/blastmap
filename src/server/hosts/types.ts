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
};

// The signed-in user's identity on one host: better-auth's account row.
export type HostAccount = { userId: string; accountId: string };

// Every host is reached through this interface. Fetching an archive joins it
// in the phase that parses repositories.
export type HostAdapter = {
  id: HostId;
  label: string;
  // Repositories the user can read, most recently active first, at most 100.
  listRepositories(account: HostAccount): Promise<Repository[]>;
  // The repository if the host says this user can read its code, otherwise
  // null. "Doesn't exist" and "can't read" are deliberately the same answer.
  readableRepository(account: HostAccount, path: string): Promise<Repository | null>;
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
