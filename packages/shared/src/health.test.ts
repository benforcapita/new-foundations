import { expect, test } from "vitest";
import { healthReport } from "./index";

test("health report names the api service", () => {
  expect(healthReport("api")).toEqual({
    ok: true,
    app: "New Foundations",
    service: "api",
  });
});
