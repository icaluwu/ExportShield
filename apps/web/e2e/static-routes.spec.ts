import { expect, test } from "@playwright/test";

test("public routes render and retain the testnet warning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MONAD TESTNET DEMO", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: /ship the work/i })).toBeVisible();
  await page.goto("/terms/");
  await expect(page.getByRole("heading", { name: /testnet demonstration terms/i })).toBeVisible();
});
