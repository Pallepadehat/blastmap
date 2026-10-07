import { requireViewer } from "@/server/session";

// Everything behind sign-in. Each page renders the top bar itself, since only
// the page knows where you are. Pages still call requireViewer: a layout isn't
// re-rendered on every navigation, so it can't be the only check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return <div className="flex h-svh flex-col">{children}</div>;
}
