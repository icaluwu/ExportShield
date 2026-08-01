import { expect, test } from "@playwright/test";

test("wallet button opens the AppKit connection dialog", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Connect Wallet" }).click();

  await expect(page.getByTestId("w3m-modal-card")).toBeVisible();
  await expect(page.locator("w3m-connect-view")).toBeAttached();
  expect(pageErrors).toEqual([]);
});
