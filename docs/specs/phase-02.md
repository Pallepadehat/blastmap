# Phase 02 — Sign-in and repositories

Sign in with GitHub or GitLab, see the repositories you can read there, and
open one by its address. No parsing or map yet. This is the identity and access
foundation everything after it stands on: access to a repository is decided by
the host, through the signed-in user's own token, and nothing else.

## What it does

### Sign-in

- Signed out, every page sends you to a sign-in page. It shows one button per
  configured host, and only those. With only GitLab configured there is no
  GitHub button.
- Signing in goes through the host's own OAuth screen and requests read-only
  scopes. GitHub asks for your profile and email and never for `repo`, so only
  public repositories are reachable. GitLab asks for `read_user` and
  `read_api`. The GitLab instance is whatever `GITLAB_URL` names, self-hosted
  included.
- Once signed in, a top bar shows your host username and avatar and a sign-out
  control. Signing out ends the session and returns you to the sign-in page.
- Host tokens are stored encrypted and read only on the server. They never
  appear in a page, a response, a log line or an error message.
- An expiring GitLab token is refreshed without you noticing. A revoked or
  unrefreshable token signs you out to the sign-in page with "sign in again",
  never an error page or an empty list.

### Repositories

- After sign-in you land on a list of repositories you can read on the host
  you signed in with. On GitHub that's public repositories you own or are a
  member of. On GitLab it's projects where you can read the code.
- The list is the 100 most recently active, each showing its full path,
  visibility, default branch and when it was last updated. A filter box
  narrows it instantly, with no request.
- An "open by path" field takes any `owner/name` (or a GitLab group path) and
  opens it if the host says you can read it. This reaches public repositories
  you aren't a member of.
- A repository has its own address, built from the host and its path. Opening
  it asks the host, as you, whether you can read it. If you can, the page shows
  its path, visibility and default branch, and says mapping isn't built yet. If
  you can't, or it doesn't exist, the page is a plain "not found". The server
  says nothing more, so a private repository's existence never leaks.
- When a host call fails, the message says what was requested and what came
  back, e.g. the URL path and the status, with no token in it.

### Operator

- Sign-in tables are created by the startup migration step, visible in the
  logs like the rest.
- The README explains registering the OAuth application on each host: where
  to click, which callback URL to enter for the instance's public URL, and
  which scopes to tick.

## Acceptance check

1. With both hosts configured, the sign-in page shows two buttons. Remove the
   GitLab variables and restart: one button.
2. Sign in with GitHub. The consent screen asks for no repository access. You
   land on your public repositories, most recent first. Typing in the filter
   narrows the list instantly.
3. Open a public repository you don't belong to (e.g. `vercel/next.js`) by
   path. Its page shows its default branch.
4. Open `some-user/definitely-not-a-repo`. The page says not found and nothing
   else.
5. Sign in with GitLab, on gitlab.com or your own instance. Your private
   projects are listed and open. Open a private project path you aren't a
   member of: not found.
6. In the database, the stored access tokens aren't readable as tokens. Search
   the page source and network responses for one: absent.
7. Revoke the app's access on the host, then reload. You're back at sign-in
   with "sign in again".
8. Sign out. Visiting the repository list sends you to sign-in.
