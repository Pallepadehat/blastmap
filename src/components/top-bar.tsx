import { cookies } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "cn";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import type { Viewer } from "@/server/session";
import { ThemeControl } from "./theme-control";
import { UserMenu } from "./user-menu";

export type Crumb = { label: string; href?: string; mono?: boolean; muted?: boolean };

// The one top bar: where you are on the left, theme and account on the right.
export async function TopBar({ viewer, crumbs = [] }: { viewer: Viewer; crumbs?: Crumb[] }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b px-3">
      <nav className="flex min-w-0 items-center gap-1.5" aria-label="Location">
        <Link href="/" className="font-semibold">
          Blastmap
        </Link>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <span className="text-muted-foreground">/</span>
            {c.href ? (
              <Link href={c.href} className={cn("truncate hover:underline", c.mono && "font-mono", c.muted && "text-muted-foreground")}>
                {c.label}
              </Link>
            ) : (
              <span className={cn("truncate", c.mono && "font-mono", c.muted && "text-muted-foreground")}>{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeControl initial={theme} />
        <UserMenu name={viewer.name} image={viewer.image} />
      </div>
    </header>
  );
}
