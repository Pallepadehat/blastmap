import { z } from "zod";
import { accessToken, hostGet, parseBody, unexpected } from "./request";
import { type HostAccount, type HostAdapter, type Repository } from "./types";

const API = "https://api.github.com";
const LABEL = "GitHub";
const HEADERS = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

const repoSchema = z.object({
  full_name: z.string(),
  private: z.boolean(),
  visibility: z.enum(["public", "private", "internal"]).optional(),
  default_branch: z.string().nullable().optional(),
  pushed_at: z.string().nullable(),
  updated_at: z.string(),
  html_url: z.string(),
  size: z.number(),
});

// Owner and repository names as GitHub allows them; anything else can't exist,
// so it's "not found" without asking.
const PATH = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

export const github: HostAdapter = {
  id: "github",
  label: LABEL,

  async listRepositories(account: HostAccount): Promise<Repository[]> {
    // Without the `repo` scope this only ever returns public repositories.
    const url = new URL(`${API}/user/repos`);
    url.search = new URLSearchParams({
      affiliation: "owner,collaborator,organization_member",
      sort: "pushed",
      per_page: "100",
    }).toString();
    const res = await hostGet("github", LABEL, url, await accessToken("github", account), HEADERS);
    if (res.status !== 200) throw unexpected(LABEL, url, res);
    return parseBody(LABEL, z.array(repoSchema), res.body, url).map(toRepository);
  },

  async readableRepository(account: HostAccount, path: string): Promise<Repository | null> {
    if (!PATH.test(path)) return null;
    const url = new URL(`${API}/repos/${path}`);
    const res = await hostGet("github", LABEL, url, await accessToken("github", account), HEADERS);
    if (res.status === 404) return null;
    if (res.status !== 200) throw unexpected(LABEL, url, res);
    return toRepository(parseBody(LABEL, repoSchema, res.body, url));
  },
};

function toRepository(r: z.infer<typeof repoSchema>): Repository {
  return {
    host: "github",
    path: r.full_name,
    visibility: r.visibility ?? (r.private ? "private" : "public"),
    // GitHub reports a default branch name even for an empty repository.
    defaultBranch: r.size === 0 && !r.pushed_at ? null : (r.default_branch ?? null),
    updatedAt: new Date(r.pushed_at ?? r.updated_at),
    webUrl: r.html_url,
  };
}

