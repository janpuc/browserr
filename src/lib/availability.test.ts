import { describe, expect, it } from "vitest";
import { availabilityKey, badgeForAvailability } from "./availability";
import { MEDIA_STATUS, type Availability } from "./types";

const a = (status: number, known = true): Availability => ({ status, known });

describe("badgeForAvailability", () => {
  it("renders Unknown (still requestable) when Seerr status is not known", () => {
    const spec = badgeForAvailability({ status: 0, known: false });
    expect(spec.label).toBe("Unknown");
    expect(spec.requestable).toBe(true);
  });

  it("treats a missing availability object as Unknown", () => {
    expect(badgeForAvailability(undefined).label).toBe("Unknown");
  });

  it("marks library/processing states as not requestable", () => {
    expect(badgeForAvailability(a(MEDIA_STATUS.AVAILABLE)).requestable).toBe(false);
    expect(badgeForAvailability(a(MEDIA_STATUS.PARTIALLY_AVAILABLE)).requestable).toBe(false);
    expect(badgeForAvailability(a(MEDIA_STATUS.PROCESSING)).requestable).toBe(false);
    expect(badgeForAvailability(a(MEDIA_STATUS.PENDING)).label).toBe("Requested");
  });

  it("offers a Request CTA for a known-but-unavailable title", () => {
    const spec = badgeForAvailability(a(MEDIA_STATUS.UNKNOWN));
    expect(spec.label).toBe("Request");
    expect(spec.requestable).toBe(true);
  });
});

describe("availabilityKey", () => {
  it("namespaces by media type and id", () => {
    expect(availabilityKey("movie", 27205)).toBe("movie:27205");
    expect(availabilityKey("tv", 1399)).toBe("tv:1399");
  });
});
