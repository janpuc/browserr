import { describe, expect, it } from "vitest";
import { cn, formatRuntime, ratingPercent } from "./utils";

describe("formatRuntime", () => {
  it("returns null for missing or non-positive runtimes", () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
    expect(formatRuntime(-30)).toBeNull();
  });

  it("formats minutes, whole hours, and hours+minutes", () => {
    expect(formatRuntime(59)).toBe("59m");
    expect(formatRuntime(60)).toBe("1h");
    expect(formatRuntime(145)).toBe("2h 25m");
  });
});

describe("ratingPercent", () => {
  it("converts a 0-10 vote average to a rounded percentage", () => {
    expect(ratingPercent(0)).toBe(0);
    expect(ratingPercent(7.8)).toBe(78);
    expect(ratingPercent(10)).toBe(100);
  });
});

describe("cn", () => {
  it("merges conditional classes and de-dupes conflicting Tailwind utilities", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4");
  });
});
