import { expect, it } from "vitest";
import { sanitize } from "../src/server/privacy";
import { validateUrl } from "../src/server/jobs";
it("removes images and credentials recursively from raw payloads", () => {
  expect(
    sanitize({
      caption: "safe",
      imageUrls: ["secret-url"],
      nested: { displayUrl: "url", cookie: "secret", text: "hello" },
      visionObservation: "ice",
    }),
  ).toEqual({
    caption: "safe",
    nested: { text: "hello" },
    visionObservation: "ice",
  });
});
it("rejects foreign hosts, credentials and unsupported paths", () => {
  for (const u of [
    "https://evil.com/p/abc/",
    "https://instagram.com.evil.com/p/abc/",
    "http://instagram.com/p/abc/",
    "https://instagram.com/accounts/login/",
  ])
    expect(() => validateUrl(u)).toThrow();
  expect(validateUrl("https://instagram.com/reel/abc/?utm_source=x")).toBe(
    "https://www.instagram.com/reel/abc/",
  );
});
