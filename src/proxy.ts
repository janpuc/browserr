import { NextResponse } from "next/server";

/** Length-independent compare so Basic creds don't leak via early-exit timing. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Optional HTTP Basic gate for AUTH_MODE=basic (creds from env; runs on the edge
 * runtime). Health checks stay open for container probes.
 */
export function proxy(req: Request) {
  if (process.env.AUTH_MODE !== "basic") return NextResponse.next();

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6).trim());
      const i = decoded.indexOf(":"); // split on first colon (passwords may contain ":")
      const u = i >= 0 ? decoded.slice(0, i) : decoded;
      const p = i >= 0 ? decoded.slice(i + 1) : "";
      const okUser = safeEqual(u, user);
      const okPass = safeEqual(p, pass);
      if (okUser && okPass) return NextResponse.next();
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
