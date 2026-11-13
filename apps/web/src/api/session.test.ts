import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";
import { bootstrapSession } from "./session";

afterEach(() => vi.restoreAllMocks());
it("resumes with recovery code and persists returned credentials", async () => {
  const values = new Map([["nf_session_token", "expired"], ["nf_recovery_code", "recovery"]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } } as Storage;
  const session = vi.spyOn(api, "session").mockRejectedValueOnce(new ApiError(401, "expired")).mockResolvedValueOnce({ token: "new", cityId: "city", userId: "user", isNew: false });
  await bootstrapSession(storage);
  expect(session.mock.calls.map((call) => call[0])).toEqual([{ token: "expired" }, { recoveryCode: "recovery" }]);
  expect(values.get("nf_session_token")).toBe("new");
  expect(values.get("nf_recovery_code")).toBe("recovery");
});
