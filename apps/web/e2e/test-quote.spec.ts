import { expect, test } from "@playwright/test";
import { connected, expectTx, waitFor } from "./helpers";

/**
 * The test quote (mUSDC) next to the primary quote:
 * mint test funds → create an mUSDC raise → contribute 10,000 → finalize → claim → spot buy → bonded proposal →
 * trade PASS. Covers permit and approve paths on the second token and its "mUSDC" labels end to end.
 * Skips when the deployment has no test quote.
 */

const SYMBOL = `M${Date.now().toString(36).toUpperCase().slice(-6)}`;

test("test quote: mint mUSDC → raise → launch → trade", async ({ page }) => {
  // ── 1. Mint test funds from the portfolio ─────────────────────────────────
  await page.goto("/portfolio");
  await connected(page);
  const mint = page.getByRole("button", { name: /^Mint 10,000 mUSDC/ });
  const hasTestQuote = await mint
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!hasTestQuote, "no test quote on this deployment");
  await mint.click();
  await expectTx(page, "Mint 10,000 mUSDC");
  await expect(page.getByRole("region", { name: "Test funds" })).toContainText(
    /\d+(\.\d)?[KM] mUSDC/,
  );

  // ── 2. Create a raise in mUSDC ────────────────────────────────────────────
  await page.goto("/create");
  await connected(page);
  await page.getByLabel("Project name").fill(`Test ${SYMBOL}`);
  await page.getByLabel("Ticker").fill(SYMBOL);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "mUSDC", exact: true }).click();
  await expect(page.getByText(/mUSDC is a test token anyone can mint/)).toBeVisible();
  await page.getByLabel("Price per token").fill("0.10");
  await page.getByLabel("Minimum raise").fill("5000");
  await page.getByLabel("Maximum raise").fill("20000");
  await page.getByLabel("Raise window").fill("1");
  await page.getByRole("radio", { name: "min" }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: /Governance settings/ }).click();
  await page.getByLabel("Warm-up").fill("5");
  await page.getByLabel("Trading window").fill("60");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // memo: keep the template

  await expect(page.getByText(/per token in mUSDC/)).toBeVisible();
  await page.getByRole("button", { name: "Publish raise" }).click();
  await expectTx(page, `Publish ${SYMBOL} raise`);
  await page.waitForURL(/\/raise\/0x[0-9a-fA-F]{40}/, { timeout: 30_000 });

  // ── 3. Contribute 10,000 mUSDC ────────────────────────────────────────────
  await expect(page.getByText("Contribution in mUSDC")).toBeVisible();
  await page.getByPlaceholder("0.00").fill("10000");
  await page.getByRole("button", { name: "Contribute" }).click();
  await expectTx(page, "Contribute $10,000.00");
  await expect(page.getByText("Your contribution: $10,000.00")).toBeVisible();

  // ── 4. Finalize (keeper or us) and claim ──────────────────────────────────
  const claim = page.getByRole("button", { name: /^Claim$/ });
  await waitFor(page, () => claim.isVisible(), {
    name: /^Finalize raise$/,
    toast: /Finalize raise/,
  });
  await claim.click();
  await expectTx(page, "Claim tokens");

  // ── 5. Top up from the trade panel's faucet, then spot buy with mUSDC ─────
  await page.getByRole("link", { name: /Go to project/ }).click();
  await page.waitForURL(/\/project\/0x[0-9a-fA-F]{40}$/);
  await expect(page.getByText("mUSDC to spend").first()).toBeVisible();
  await page.getByRole("button", { name: /^Mint 10,000 mUSDC/ }).click();
  await expectTx(page, "Mint 10,000 mUSDC");
  await page.getByPlaceholder("0.00").fill("100");
  await page.getByRole("button", { name: `Buy ${SYMBOL}` }).click();
  await expectTx(page, `Buy ${SYMBOL} with $100.00`);

  // ── 6. Propose a tranche release (bond paid in mUSDC) and trade PASS ──────
  await page.getByRole("link", { name: "New proposal" }).first().click();
  await page.waitForURL(/\/propose$/);
  await page.getByRole("radio", { name: /Release tranche/ }).check({ force: true });
  await page.getByRole("radio", { name: /Tranche 1/ }).check({ force: true });
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expectTx(page, /Propose: Release Tranche 1/);
  await page.waitForURL(/\/proposal\/\d+$/, { timeout: 30_000 });

  await expect(page.getByRole("heading", { name: "Trade the verdict" })).toBeVisible();
  await expect(page.getByText("mUSDC to spend").first()).toBeVisible();
  await page.getByPlaceholder("0.00").fill("2");
  await page.getByText("5.0%", { exact: true }).click();
  await page.getByRole("button", { name: /Buy PASS/ }).click();
  await expectTx(page, "Buy PASS with $2.00");
  await expect(page.getByText("▼ FAIL-mUSDC")).toBeVisible();
});
