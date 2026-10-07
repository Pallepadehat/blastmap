import type { z } from "zod";
import { auth } from "../auth";
import { HostAuthError, HostRequestError, type HostAccount, type HostId } from "./types";

const TIMEOUT_MS = 15_000;

// A valid access token for the account, refreshed by better-auth if it has
// expired. The only place in the app a host token is read.
export async function accessToken(host: HostId, account: HostAccount): Promise<string> {
  try {
    const { accessToken } = await auth().api.getAccessToken({
      body: { accountId: account.accountId, userId: account.userId },
    });
    return accessToken;
  } catch {
    // better-auth's error can carry the provider's refresh response; keep it
    // out of anything that might be shown or logged.
    throw new HostAuthError(host, "token could not be refreshed");
  }
}

export type HostResponse = { status: number; body: unknown };

// GET a host API URL as the user. 401 becomes HostAuthError. Any other status
// is returned for the adapter to interpret, so it can treat 404 as "not
// readable". Failures without a response become HostRequestError naming the
// request and the cause.
export async function hostGet(
  host: HostId,
  label: string,
  url: URL,
  token: string,
  headers: Record<string, string> = {},
): Promise<HostResponse> {
  const what = `${label} GET ${url.pathname}${url.search}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { ...headers, Authorization: `Bearer ${token}`, "User-Agent": "blastmap" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new HostRequestError(`${what}: no response (${describeFetchError(err)})`);
  }

  if (res.status === 401) throw new HostAuthError(host, `${what} returned 401`);

  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON (a proxy's HTML error page, say); keep the text for the message.
  }
  return { status: res.status, body };
}

// GET a host URL as the user and hand back the body as a stream, for archives.
// Fails like hostGet for anything but 200.
export async function hostStream(
  host: HostId,
  label: string,
  url: URL,
  token: string,
  headers: Record<string, string> = {},
): Promise<{ body: ReadableStream<Uint8Array>; length: number | null }> {
  const what = `${label} GET ${url.pathname}${url.search}`;
  let res: Response;
  try {
    // No timeout on the whole download, only on getting a response: a large
    // archive legitimately takes a while.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), TIMEOUT_MS);
    res = await fetch(url, {
      headers: { ...headers, Authorization: `Bearer ${token}`, "User-Agent": "blastmap" },
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
  } catch (err) {
    throw new HostRequestError(`${what}: no response (${describeFetchError(err)})`);
  }
  if (res.status === 401) throw new HostAuthError(host, `${what} returned 401`);
  if (res.status !== 200 || !res.body) {
    throw unexpected(label, url, { status: res.status, body: await res.text().catch(() => "") });
  }
  const length = Number(res.headers.get("content-length"));
  return { body: res.body, length: Number.isFinite(length) && length > 0 ? length : null };
}

export function unexpected(label: string, url: URL, res: HostResponse): HostRequestError {
  const detail =
    typeof res.body === "object" && res.body !== null && "message" in res.body
      ? String(res.body.message)
      : typeof res.body === "string"
        ? res.body.slice(0, 200)
        : "";
  return new HostRequestError(
    `${label} GET ${url.pathname}${url.search} returned ${res.status}${detail ? `: ${detail}` : ""}`,
  );
}

export function parseBody<T>(label: string, schema: z.ZodType<T>, body: unknown, url: URL): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HostRequestError(`${label} GET ${url.pathname} returned a response in an unexpected shape`);
  }
  return result.data;
}

// fetch() reports network and TLS failures as "fetch failed" with the useful
// part (ECONNREFUSED, a certificate error, a timeout) in `cause`.
function describeFetchError(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") return `timed out after ${TIMEOUT_MS / 1000}s`;
  let cause: unknown = err;
  while (cause instanceof Error && cause.cause !== undefined) cause = cause.cause;
  if (cause instanceof Error) {
    const code = "code" in cause && typeof cause.code === "string" ? `${cause.code}: ` : "";
    return `${code}${cause.message}`;
  }
  return String(cause);
}
