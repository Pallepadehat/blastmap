"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { adapterFor } from "./hosts";

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
