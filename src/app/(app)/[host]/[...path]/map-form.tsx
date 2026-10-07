"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mapBranch, type MapState } from "@/server/actions";

export function MapForm({ host, path, branches }: { host: string; path: string; branches: string[] }) {
  const [state, action, pending] = useActionState<MapState, FormData>(mapBranch.bind(null, host, path), {
    error: null,
  });

  if (branches.length === 0) {
    return <p className="text-muted-foreground">No branches to map: the repository is empty.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Select name="branch" defaultValue={branches[0]} items={branches.map((b) => ({ value: b, label: b }))}>
          <SelectTrigger size="sm" className="min-w-40 font-mono text-xs" aria-label="Branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branches.map((b) => (
                <SelectItem key={b} value={b} className="font-mono text-xs">
                  {b}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Starting" : "Map"}
        </Button>
      </div>
      {state.error && (
        <Alert variant="destructive" className="w-fit">
          <AlertDescription className="font-mono text-xs">{state.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
