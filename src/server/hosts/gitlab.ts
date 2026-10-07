import { z } from "zod";
import { env } from "../env";
import { accessToken, hostGet, parseBody, unexpected } from "./request";
import { type HostAccount, type HostAdapter, type Repository } from "./types";

const LABEL = "GitLab";

// GitLab access levels. Reporter is the lowest role that can read a private
// project's code.
const REPORTER = 20;

const projectSchema = z.object({
  path_with_namespace: z.string(),
  visibility: z.enum(["public", "internal", "private"]),
  default_branch: z.string().nullable().optional(),
  last_activity_at: z.string(),
  web_url: z.string(),
  repository_access_level: z.enum(["enabled", "private", "disabled"]).optional(),
  permissions: z
    .object({
      project_access: z.object({ access_level: z.number() }).nullable().optional(),
      group_access: z.object({ access_level: z.number() }).nullable().optional(),
    })
    .optional(),
});

type Project = z.infer<typeof projectSchema>;

// Namespace segments as GitLab allows them, at least group/project.
const PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)+$/;

function api(path: string): URL {
  // GITLAB_URL may carry a base path (https://example.com/gitlab), so append
  // rather than resolve from the root.
  return new URL(`${env().gitlab?.url.replace(/\/+$/, "")}/api/v4${path}`);
}

export const gitlab: HostAdapter = {
  id: "gitlab",
  label: LABEL,

  async listRepositories(account: HostAccount): Promise<Repository[]> {
    const url = api("/projects");
    url.search = new URLSearchParams({
      membership: "true",
      min_access_level: String(REPORTER),
      order_by: "last_activity_at",
      sort: "desc",
      per_page: "100",
    }).toString();
    const res = await hostGet("gitlab", LABEL, url, await accessToken("gitlab", account));
    if (res.status !== 200) throw unexpected(LABEL, url, res);
    return parseBody(LABEL, z.array(projectSchema), res.body, url).map(toRepository);
  },

  async readableRepository(account: HostAccount, path: string): Promise<Repository | null> {
    if (!PATH.test(path)) return null;
    const url = api(`/projects/${encodeURIComponent(path)}`);
    const res = await hostGet("gitlab", LABEL, url, await accessToken("gitlab", account));
    // GitLab answers 404 for a project the user can't see; 403 for one they
    // can see but not read in this way. Both mean "not readable".
    if (res.status === 404 || res.status === 403) return null;
    if (res.status !== 200) throw unexpected(LABEL, url, res);
    const project = parseBody(LABEL, projectSchema, res.body, url);
    return canReadCode(project) ? toRepository(project) : null;
  },
};

// Seeing a project isn't the same as reading its code: a guest on a private
// project, or anyone outside a project whose repository is members-only, sees
// the project but not the repository.
function canReadCode(p: Project): boolean {
  const level = Math.max(
    p.permissions?.project_access?.access_level ?? 0,
    p.permissions?.group_access?.access_level ?? 0,
  );
  if (level >= REPORTER) return true;
  return p.visibility !== "private" && (p.repository_access_level ?? "enabled") === "enabled";
}

function toRepository(p: Project): Repository {
  return {
    host: "gitlab",
    path: p.path_with_namespace,
    visibility: p.visibility,
    defaultBranch: p.default_branch ?? null,
    updatedAt: new Date(p.last_activity_at),
    webUrl: p.web_url,
  };
}

