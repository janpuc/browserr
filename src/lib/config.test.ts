import { describe, expect, it } from "vitest";
import {
  deepMergeConfig,
  defaultConfig,
  settingsPatchSchema,
  toPublicConfig,
  type BrowserrConfig,
} from "./config";

describe("deepMergeConfig", () => {
  it("merges a nested partial over the base (env over defaults)", () => {
    const base = defaultConfig();
    const merged = deepMergeConfig(base, { tmdb: { language: "fr-FR" } });
    expect(merged.tmdb.language).toBe("fr-FR");
    // untouched siblings survive
    expect(merged.tmdb.apiKey).toBe(base.tmdb.apiKey);
    expect(merged.region.region).toBe(base.region.region);
  });

  it("replaces arrays wholesale rather than concatenating", () => {
    const base = defaultConfig();
    base.region.services = [8, 9];
    const merged = deepMergeConfig(base, { region: { services: [337] } });
    expect(merged.region.services).toEqual([337]);
  });

  it("ignores undefined/null patches and leaves the base intact", () => {
    const base = defaultConfig();
    expect(deepMergeConfig(base, undefined)).toBe(base);
    expect(deepMergeConfig(base, null)).toBe(base);
    const merged = deepMergeConfig(base, { core: { tz: undefined } });
    expect(merged.core.tz).toBe(base.core.tz);
  });
});

describe("toPublicConfig", () => {
  // A config whose every secret carries a unique, greppable sentinel value.
  const secretCfg = (): BrowserrConfig => {
    const c = defaultConfig();
    c.tmdb.apiKey = "TMDB_KEY_SENTINEL";
    c.tmdb.accessToken = "TMDB_TOKEN_SENTINEL";
    c.seerr.internalUrl = "http://seerr-internal.local:5055/SECRET";
    c.seerr.externalUrl = "https://requests.example.com";
    c.seerr.apiKey = "SEERR_KEY_SENTINEL";
    c.auth.sessionSecret = "SESSION_SECRET_SENTINEL";
    c.auth.basicPass = "BASIC_PASS_SENTINEL";
    c.data.databaseUrl = "sqlite:///DB_SENTINEL";
    return c;
  };

  it("NEVER leaks the internal Seerr URL or any secret to the client", () => {
    const pub = toPublicConfig(secretCfg(), "1.0.0");
    const serialized = JSON.stringify(pub);
    for (const leak of [
      "TMDB_KEY_SENTINEL",
      "TMDB_TOKEN_SENTINEL",
      "seerr-internal.local",
      "SEERR_KEY_SENTINEL",
      "SESSION_SECRET_SENTINEL",
      "BASIC_PASS_SENTINEL",
      "DB_SENTINEL",
    ]) {
      expect(serialized).not.toContain(leak);
    }
    expect("internalUrl" in pub.seerr).toBe(false);
  });

  it("exposes only the browser-facing external URL and configured booleans", () => {
    const pub = toPublicConfig(secretCfg(), "1.2.3");
    expect(pub.seerr.externalUrl).toBe("https://requests.example.com");
    expect(pub.seerr.hasKey).toBe(true);
    expect(pub.seerr.configured).toBe(true); // internalUrl + apiKey both present
    expect(pub.tmdb.hasKey).toBe(true);
    expect(pub.core.version).toBe("1.2.3");
  });

  it("reports tmdb/seerr as not-configured when credentials are absent", () => {
    const pub = toPublicConfig(defaultConfig(), "0.0.0");
    expect(pub.tmdb.configured).toBe(false);
    expect(pub.seerr.configured).toBe(false);
    expect(pub.seerr.hasKey).toBe(false);
  });
});

describe("settingsPatchSchema", () => {
  it("accepts a sparse partial patch", () => {
    const r = settingsPatchSchema.safeParse({ region: { region: "GB" } });
    expect(r.success).toBe(true);
  });

  it("rejects a region code that is not 2 characters", () => {
    const r = settingsPatchSchema.safeParse({ region: { region: "USA" } });
    expect(r.success).toBe(false);
  });

  it("rejects a non-URL internal Seerr URL but allows empty string", () => {
    expect(settingsPatchSchema.safeParse({ seerr: { internalUrl: "not-a-url" } }).success).toBe(
      false,
    );
    expect(settingsPatchSchema.safeParse({ seerr: { internalUrl: "" } }).success).toBe(true);
  });

  it("bounds heroRotateSeconds to a sane range", () => {
    expect(settingsPatchSchema.safeParse({ features: { heroRotateSeconds: 12 } }).success).toBe(
      true,
    );
    expect(settingsPatchSchema.safeParse({ features: { heroRotateSeconds: 999 } }).success).toBe(
      false,
    );
  });
});
