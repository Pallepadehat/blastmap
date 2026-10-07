// Turns a database error into the line worth showing an operator. Drizzle wraps
// driver errors as "Failed query: ...", so the innermost cause is the useful
// part. Driver messages never include the password from DATABASE_URL.
export function describeDbError(err: unknown): string {
  let cause: unknown = err;
  while (cause instanceof Error && cause.cause !== undefined) cause = cause.cause;
  return describe(cause);
}

// When a host resolves to both IPv4 and IPv6, Node reports a refused connection
// as an AggregateError with an empty message and one error per address.
function describe(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length > 0) {
    return err.errors.map(describe).join("; ");
  }
  if (err instanceof Error && err.message) return err.message;
  return "unreachable";
}
