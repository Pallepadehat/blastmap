import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blastmap",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-[13px] leading-snug antialiased">{children}</body>
    </html>
  );
}
