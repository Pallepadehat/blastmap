import type { Metadata } from "next";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, themeClass } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blastmap",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" className={themeClass(theme)}>
      <body className="font-sans text-[13px] leading-snug antialiased">{children}</body>
    </html>
  );
}
