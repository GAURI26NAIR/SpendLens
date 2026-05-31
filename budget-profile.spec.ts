import { expect, test } from "@playwright/test";

test("creates a location-aware budget profile and reaches grocery discounts", async ({
  page,
}) => {
  await page.goto("/app/profile");

  await page.getByLabel("Country").selectOption("Switzerland");
  await page.getByLabel("Postal Code").fill("8000");
  await page.getByLabel(/City/).fill("Zurich");
  await page.getByLabel("Monthly Income").fill("5000");
  await page.getByLabel("Housing Expense").fill("1500");
  await page.getByLabel("Food Expense").fill("450");
  await page.getByLabel("Transport Expense").fill("150");
  await page.getByLabel("Utilities Expense").fill("120");
  await page.getByLabel("Healthcare Expense").fill("300");
  await page.getByLabel("Debt Expense").fill("0");
  await page.getByLabel("Entertainment Expense").fill("100");
  await page.getByLabel("Other Expense").fill("80");

  await page.getByRole("button", { name: "Generate Budget Plan" }).click();

  await expect(page.getByRole("heading", { name: "Your monthly budget overview" })).toBeVisible();
  await page.getByRole("link", { name: "Find Grocery Discounts" }).click();
  await expect(page.getByRole("heading", { name: "Find local offers for regular buys" })).toBeVisible();
  await expect(page.getByText("Zurich 8000")).toBeVisible();
});
