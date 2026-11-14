import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("Tom's train accepts a wagon and dispatches a partial load", async ({ page, request }) => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const session = await (await request.post(`http://127.0.0.1:${process.env.NF_E2E_API_PORT ?? 3002}/v1/auth/session`, { data: {} })).json() as { token: string; cityId: string };
  execFileSync("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c", `update cities set level = 3, xp = 150 where id = '${session.cityId}'; insert into building_instances (id, city_id, definition_id, x, y, state) values (gen_random_uuid(), '${session.cityId}', 'B-011', 0, 0, 'ACTIVE'); insert into inventory_balances (city_id, good_id, qty, version) values ('${session.cityId}', 'GOOD_WHEAT', 3, 1) on conflict (city_id, good_id) do update set qty = 3;`]);
  await page.addInitScript(token => localStorage.setItem("nf_session_token", token), session.token);
  await page.goto("/?e2e=1");
  await page.getByTestId("train-open").click();
  await page.getByTestId("train-wagon-0").getByRole("button", { name: "Fill wagon" }).click();
  await expect(page.getByTestId("train-wagon-0")).toContainText("Filled");
  await page.getByTestId("train-dispatch").click();
  await expect(page.getByTestId("train-panel")).toContainText("on its way");
});
