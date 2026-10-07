import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions";
import { requireViewer } from "@/server/session";

// Everything behind sign-in. Pages still call requireViewer themselves: a
// layout isn't re-rendered on every navigation, so it can't be the only check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <Link href="/" className="font-semibold">
          Blastmap
        </Link>
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            {viewer.image && <AvatarImage src={viewer.image} alt="" />}
            <AvatarFallback>{viewer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-mono text-xs">{viewer.name}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="xs">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
