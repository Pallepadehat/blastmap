export default function Home() {
  return (
    <main className="p-4">
      <h1 className="font-semibold">Blastmap</h1>
      <p className="mt-1 text-muted-foreground">
        Running. Health at <span className="font-mono">/api/health</span>.
      </p>
    </main>
  );
}
