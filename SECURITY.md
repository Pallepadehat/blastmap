# Security

Blastmap holds sign-in tokens for people's GitHub and GitLab accounts and
decides who can see which repository's map. Security reports are taken
seriously and handled before anything else.

## Reporting a vulnerability

**Please don't open a public issue.** Report privately through GitHub:
**[Report a vulnerability](https://github.com/Pallepadehat/blastmap/security/advisories/new)**
(the Security tab → Advisories → Report a vulnerability).

Include what you found, how to reproduce it, and what an attacker could do with
it. You'll get an acknowledgement within a few days, and the fix will be
coordinated with you before anything is disclosed. You'll be credited in the
advisory unless you'd rather not be.

## What counts

Things that matter most, in rough order:

- **Tokens leaving the server.** A host token reaching the browser, a log line,
  an error message, or the database unencrypted.
- **Access bypass.** Getting any part of a mapping (its page, its progress
  stream, or anything else touching analysis data) for a repository the host
  says you can't read.
- **Data leaving the instance.** Any request carrying code or analysis data to
  somewhere other than the git host or the configured AI endpoint.
- **Write access.** Anything that leads Blastmap to request or use a write
  scope on a git host.
- The usual web vulnerabilities: XSS, CSRF on state-changing actions, SSRF,
  path traversal while unpacking archives, and so on.

Out of scope: denial of service through very large repositories (there's a
stated, fixed size limit), and findings that need control of the instance's
environment or database.

## Supported versions

Blastmap is in early development with no tagged releases yet. Fixes land on
`develop` and reach `master` with the next release. Run the latest `master`.

## How Blastmap protects you

See [docs/deployment.md → What's stored where](docs/deployment.md#whats-stored-where)
for what an instance stores and sends. In short:

- **Host tokens:** encrypted at rest with `BETTER_AUTH_SECRET`, read only by the
  host adapters on the server, and never sent to the browser.
- **Scopes:** read-only on every host.
- **Access to mappings:** every read is checked with the host as the signed-in
  user. The answer is cached for at most 5 minutes.
- **No telemetry:** the instance sends nothing to its maintainers or third
  parties.
