import { expect, test } from "vitest";
import { originAllowed, parseCorsOrigin } from "./cors";

test("cors allows localhost, loopback, and Vercel preview hosts", () => {
  const configured = parseCorsOrigin("https://play.example.com, https://*.example.net");
  expect(originAllowed("http://localhost:5173", configured)).toBe(true);
  expect(originAllowed("http://127.0.0.1:3001", configured)).toBe(true);
  expect(originAllowed("https://new-foundations.vercel.app", configured)).toBe(true);
  expect(originAllowed("https://new-foundations-git-main-ben.vercel.app", configured)).toBe(true);
  expect(originAllowed("https://play.example.com", configured)).toBe(true);
  expect(originAllowed("https://preview.example.net", configured)).toBe(true);
  expect(originAllowed("https://evil.example", configured)).toBe(false);
  expect(originAllowed("http://localhost.evil.com", configured)).toBe(false);
});
