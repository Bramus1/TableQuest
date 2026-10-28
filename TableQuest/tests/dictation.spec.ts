import { test, expect } from "@playwright/test";
test("unsupported speech keeps keyboard entry available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "La tua prima avventura? Registrati" })
    .click();
  await expect(
    page.getByText(/La dettatura diretta non è supportata/),
  ).toBeVisible();
  await page.getByLabel("Come ti chiami?").fill("Giulia");
  await expect(page.getByLabel("Come ti chiami?")).toHaveValue("Giulia");
  await expect(page.getByRole("button", { name: /^Detta:/ })).toHaveCount(0);
});
