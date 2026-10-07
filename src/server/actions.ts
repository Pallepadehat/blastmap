"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { adapterFor, HostAuthError, HostRequestError } from "./hosts";
import { remapOutdated, startMapping, type StartResult } from "./mappings";
import { requireViewer } from "./session";

// Starts the host's OAuth flow. `host` comes from the browser, so it's checked
// against the configured hosts rather than trusted.
export async function signInWith(host: string): Promise<void> {
  if (!adapterFor(host)) redirect("/sign-in");
  const { url } = await auth().api.signInSocial({
    body: { provider: host, callbackURL: "/", errorCallbackURL: "/sign-in" },
    headers: await headers(),
  });
  redirect(url ?? "/sign-in");
}

export async function signOut(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

export type MapState = { error: string | null };

// The Map button. Resolves the branch to a commit and opens that mapping,
// which is either already there or starting.
export async function mapBranch(host: string, path: string, _prev: MapState, form: FormData): Promise<MapState> {
  const branch = form.get("branch");
  if (typeof branch !== "string" || branch === "") return { error: "Pick a branch." };
  const viewer = await requireViewer();

  let result: StartResult | null;
  try {
    result = await startMapping(viewer, host, path, branch);
  } catch (err) {
    if (err instanceof HostRequestError) return { error: err.message };
    if (err instanceof HostAuthError) redirect(`/session-ended?host=${err.host}`);
    throw err;
  }
  if (!result) return { error: "Not found." };
  if ("error" in result) return result;
  redirect(`/${host}/${path}?commit=${result.commit}`);
}

// "Map again" on a mapping made before kinds and routes existed.
export async function remapCommit(host: string, path: string, commit: string): Promise<void> {
  const viewer = await requireViewer();
  try {
    await remapOutdated(viewer, host, path, commit);
  } catch (err) {
    if (err instanceof HostAuthError) redirect(`/session-ended?host=${err.host}`);
    throw err;
  }
  redirect(`/${host}/${path}?commit=${commit}`);
}
