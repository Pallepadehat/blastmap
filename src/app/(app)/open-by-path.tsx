"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Reaches repositories the list can't show, e.g. public ones you don't belong
// to. Accepts a path or a pasted host URL; whether you can read it is the
// repository page's question, asked of the host.
export function OpenByPath({ host, placeholder }: { host: string; placeholder: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const open = (e: React.FormEvent) => {
    e.preventDefault();
    const path = toPath(value);
    if (path) router.push(`/${host}/${path}`);
  };

  return (
    <form onSubmit={open} className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Repository path"
        className="h-7 w-64 font-mono text-xs"
      />
      <Button type="submit" variant="outline" size="sm" disabled={!toPath(value)}>
        Open
      </Button>
    </form>
  );
}

function toPath(input: string): string {
  let path = input.trim();
  if (URL.canParse(path)) path = new URL(path).pathname;
  return path.replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
}
