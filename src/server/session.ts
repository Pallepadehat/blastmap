import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { adapterFor, type HostAccount, type HostAdapter } from "./hosts";

export type Viewer = {
  userId: string;
  name: string;
  image: string | null;
  // The user's identities on hosts this instance has configured, in the
  // configured order.
  hosts: { adapter: HostAdapter; account: HostAccount }[];
};

// The signed-in user, or null. Cached per request, so a layout and its page
// share one session lookup.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  if (!session) return null;

  const accounts = await auth().api.listUserAccounts({ headers: h });
  const hosts = accounts.flatMap((a) => {
    const adapter = adapterFor(a.providerId);
    return adapter ? [{ adapter, account: { userId: session.user.id, accountId: a.id } }] : [];
  });

  return { userId: session.user.id, name: session.user.name, image: session.user.image ?? null, hosts };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}
