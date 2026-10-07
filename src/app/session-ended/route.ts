import { auth } from "@/server/auth";
import { isHostId } from "@/server/hosts";

// Where a page sends you when the host rejects your token. Rendering can't
// clear cookies, so this signs you out and lands on the sign-in page with the
// reason. It's a GET, so a link elsewhere could sign someone out; that costs
// them one click and exposes nothing.
export async function GET(request: Request) {
  const host = new URL(request.url).searchParams.get("host") ?? "";
  const signedOut = await auth().api.signOut({ headers: request.headers, asResponse: true });

  const target = new URL("/sign-in", request.url);
  if (isHostId(host)) target.searchParams.set("ended", host);

  const headers = new Headers({ Location: target.toString() });
  for (const cookie of signedOut.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
