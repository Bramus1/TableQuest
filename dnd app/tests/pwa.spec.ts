import { test, expect } from "@playwright/test";
test("production manifest and offline app-shell reload", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator("h1")).toBeVisible();
  const manifest = await (
    await page.request.get("http://127.0.0.1:4173/manifest.webmanifest")
  ).json();
  expect(manifest.name).toBe("TableQuest");
  expect(manifest.display).toBe("standalone");
  expect(
    manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512"),
  ).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const title = await page.locator("h1").innerText();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1")).toHaveText(title, { useInnerText: true });
  await context.setOffline(false);
});
