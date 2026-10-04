import { expect, test, type Page } from "@playwright/test";

/**
 * The full user journey through the UI:
 * create raise → contribute → finalize → claim → propose tranche → trade PASS → verdict → redeem → portfolio.
 * Uses fast windows (1 min raise, 5 s warm-up, 1 min TWAP), which the local/testnet factory bounds allow.
 * The keeper bot normally finalizes; the test clicks "Finalize" itself if the keeper hasn't yet.
 */

const SYMBOL = `E${Date.now().toString(36).toUpperCase().slice(-6)}`;

/** Wait for the transaction toast titled `title` to reach Confirmed/Final; fail fast on revert. */
async function expectTx(page: Page, title: string | RegExp, timeout = 60_000) {
  const toast = page.getByRole("status").filter({ hasText: title }).last();
  await expect(toast).toBeVisible({ timeout });
  await expect(toast).toContainText(/Confirmed|Final|Reverted|Failed/, { timeout });
  const text = (await toast.textContent()) ?? "";
  expect(text, `transaction "${title}" failed: ${text}`).not.toMatch(/Reverted|Failed/);
}

async function connected(page: Page) {
  // The scripted wallet auto-connects in E2E builds; the wallet button then shows the short address.
  await expect(
    page.getByRole("button", { name: /0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}/ }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** Poll until `done` is visible, clicking `nudge` (e.g. a Finalize button) when it shows up. */
async function waitFor(
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

test("user journey: raise → launch → verdict → redeem", async ({ page }) => {
  // ── 1. Create a raise through the wizard ───────────────────────────────────
  await page.goto("/create");
  await connected(page);
  await page.getByLabel("Project name").fill(`E2E ${SYMBOL}`);
  await page.getByLabel("Ticker").fill(SYMBOL);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Price per token").fill("0.10");
  await page.getByLabel("Minimum raise").fill("10");
  await page.getByLabel("Maximum raise").fill("100");
  await page.getByLabel("Raise window").fill("1");
  await page.getByRole("radio", { name: "min" }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: /Governance settings/ }).click();
  await page.getByLabel("Warm-up").fill("5");
  await page.getByLabel("Trading window").fill("60");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // memo: keep the template

  await expect(page.getByText("If the raise ends at")).toBeVisible();
  await page.getByRole("button", { name: "Publish raise" }).click();
  await expectTx(page, `Publish ${SYMBOL} raise`);
  await page.waitForURL(/\/raise\/0x[0-9a-fA-F]{40}/, { timeout: 30_000 });

  // ── 2. Contribute ──────────────────────────────────────────────────────────
  await page.getByPlaceholder("0.00").fill("100");
  await page.getByRole("button", { name: "Contribute" }).click();
  await expectTx(page, "Contribute $100.00");
  await expect(page.getByText("Your contribution: $100.00")).toBeVisible();

  // ── 3. Finalize (keeper or us) and claim ───────────────────────────────────
  const claim = page.getByRole("button", { name: /^Claim$/ });
  await waitFor(page, () => claim.isVisible(), {
    name: /^Finalize raise$/,
    toast: /Finalize raise/,
  });
  await claim.click();
  await expectTx(page, "Claim tokens");
  await expect(page.getByText(/Claimed/)).toBeVisible();

  // ── 4. Propose a tranche release (we are the founder) ─────────────────────
  await page.getByRole("link", { name: /Go to project/ }).click();
  await page.waitForURL(/\/project\/0x[0-9a-fA-F]{40}$/);
  await page.getByRole("link", { name: "New proposal" }).first().click();
  await page.waitForURL(/\/propose$/);
  await page.getByRole("radio", { name: /Release tranche/ }).check({ force: true });
  await page.getByRole("radio", { name: /Tranche 1/ }).check({ force: true });
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expectTx(page, /Propose: Release Tranche 1/);
  await page.waitForURL(/\/proposal\/\d+$/, { timeout: 30_000 });

  // ── 5. Trade: buy PASS with 2 USDC (market-maker bots trade the same market, so allow 5% slippage) ──
  await expect(page.getByRole("heading", { name: "Trade the verdict" })).toBeVisible();
  await page.getByPlaceholder("0.00").fill("2");
  await page.getByText("5.0%", { exact: true }).click();
  await expect(page.getByLabel("5.0% slippage")).toBeChecked();
  await page.getByRole("button", { name: /Buy PASS/ }).click();
  await expectTx(page, "Buy PASS with $2.00");
  await expect(page.getByRole("heading", { name: "Your positions" })).toBeVisible();

  // ── 6. Verdict (keeper or us), then redeem the winning side ───────────────
  const redeem = page.getByRole("button", { name: /^Redeem (▲ PASS|▼ FAIL) side$/ });
  await waitFor(page, () => redeem.isVisible(), {
    name: /^Finalize verdict$/,
    toast: /Finalize proposal/,
  });
  await expect(page.getByText(/▲ PASS|▼ FAIL/).first()).toBeVisible();
  await redeem.click();
  await expectTx(page, "Redeem winning positions");

  // ── 7. Portfolio reflects the claimed contribution ────────────────────────
  await page.goto("/portfolio");
  await connected(page);
  const row = page.getByRole("row").filter({ hasText: `E2E ${SYMBOL}` });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("Claimed");
});
