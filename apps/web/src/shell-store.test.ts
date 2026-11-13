import { beforeEach, expect, test } from "vitest";
import { useShellStore } from "./shell-store";

beforeEach(() => {
  useShellStore.setState({ ready: false });
});

test("markReady records that the shell is ready", () => {
  expect(useShellStore.getState().ready).toBe(false);
  useShellStore.getState().markReady();
  expect(useShellStore.getState().ready).toBe(true);
});
