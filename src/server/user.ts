import "server-only";
import { cookies } from "next/headers";
import { getConfig } from "./config";

export const DEFAULT_USER_ID = "default";
const UID_COOKIE = "browserr_uid";

/**
 * Resolve the current taste-profile user id.
 *
 * - AUTH_MODE=none / basic → a single shared profile ("default"), per spec
 *   (trusted LAN, single shared profile).
 * - AUTH_MODE=seerr → the Seerr user id stored in the session cookie at login,
 *   so taste profiles and proxied requests are attributed correctly.
 */
export async function getCurrentUserId(): Promise<string> {
  const cfg = await getConfig();
  if (cfg.auth.mode === "seerr") {
    const jar = await cookies();
    const uid = jar.get(UID_COOKIE)?.value;
    if (uid) return uid;
  }
  return DEFAULT_USER_ID;
}
