import { describe, expect, it } from "vitest";
import { assertSafeUpstreamUrl, UpstreamUrlError } from "./net";

describe("assertSafeUpstreamUrl (SSRF guard)", () => {
  it("allows normal and private-LAN Seerr targets", () => {
    for (const u of [
      "http://seerr:5055",
      "http://10.0.0.5:5055",
      "http://192.168.1.20:5055",
      "http://172.16.4.4:5055",
      "https://requests.example.com",
    ]) {
      expect(() => assertSafeUpstreamUrl(u), u).not.toThrow();
    }
  });

  it("blocks cloud-metadata and link-local addresses", () => {
    for (const u of [
      "http://169.254.169.254/latest/meta-data/",
      "http://169.254.169.254",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://100.100.100.200/",
      "http://[fe80::1]/",
      "http://[fd00:ec2::254]/",
    ]) {
      expect(() => assertSafeUpstreamUrl(u), u).toThrow(UpstreamUrlError);
    }
  });

  it("rejects non-http(s) schemes and unparseable input", () => {
    for (const u of ["file:///etc/passwd", "gopher://x/", "ftp://host/", "not a url", ""]) {
      expect(() => assertSafeUpstreamUrl(u), u).toThrow(UpstreamUrlError);
    }
  });
});
