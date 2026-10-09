import { expect, type Page } from "@playwright/test";

/** Shared steps for the E2E specs. */

/** Wait for the transaction toast titled `title` to reach Confirmed/Final; fail fast on revert. */
export async function expectTx(page: Page, title: string | RegExp, timeout = 60_000) {
  const toast = page.getByRole("status").filter({ hasText: title }).last();
  await expect(toast).toBeVisible({ timeout });
  await expect(toast).toContainText(/Confirmed|Final|Reverted|Failed/, { timeout });
  const text = (await toast.textContent()) ?? "";
  expect(text, `transaction "${title}" failed: ${text}`).not.toMatch(/Reverted|Failed/);
}

export async function connected(page: Page) {
  // The scripted wallet auto-connects in E2E builds; the wallet button then shows the short address.
  await expect(
    page.getByRole("button", { name: /0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}/ }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** Poll until `done` is visible, clicking `nudge` (e.g. a Finalize button) when it shows up. */
export async function waitFor(
  page: Page,
  done: () => Promise<boolean>,
  nudge?: { name: RegExp; toast: RegExp },
  timeout = 180_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await done()) return;
    if (nudge) {
      const b = page.getByRole("button", { name: nudge.name });
      if ((await b.count()) && (await b.first().isEnabled())) {
        await b.first().click();
        await expectTx(page, nudge.toast).catch(() => undefined); // the keeper may have won the race
      }
    }
    await page.waitForTimeout(2_000);
  }
  throw new Error("timed out waiting for state");
}
