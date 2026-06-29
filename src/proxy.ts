import { NextResponse } from "next/server";

/**
 * Optional HTTP Basic gate for AUTH_MODE=basic. Reads credentials from env only
 * (this runs on the edge runtime and can't reach the DB). Health checks are
 * intentionally left open for container probes.
 *
 * Next 16 renamed the `middleware` file convention to `proxy`.
 */
export function proxy(req: Request) {
  if (process.env.AUTH_MODE !== "basic") return NextResponse.next();

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      /* fall through to challenge */
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Browserr"' },
  });
}

export const config = {
  // Guard everything except Next internals, health probe and favicon.
  matcher: ["/((?!_next/static|_next/image|api/health|favicon.ico).*)"],
};
