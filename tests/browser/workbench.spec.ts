import { test, expect, type Page } from "@playwright/test";

const creator = "FnHyam9w4NZoWR6mKN1CuGBritdsEWZQa4Z4oawLZGxa";
const provider = "JJBeanoTcSMU3xKQa5Gru71Wi3AaEgTfA6z7MaLUT6h";
const quoteId = "3f04ca42-8efe-4ef5-972d-c983e335ebd8";
const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

async function stubModel(page: Page) {
  await page.route("**/api/v1/model", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      network: "devnet", modelId: "mobilenet-v3-small", weightsId: "IMAGENET1K_V1",
      provenance: "Upstream torchvision", priceLamports: "10000000",
      creator: {address: creator, lamports: "7000000"},
      provider: {address: provider, lamports: "3000000"},
    }),
  }));
}
async function stubRecoveredRequest(page: Page, body: Record<string,unknown>) {
  await page.addInitScript(({id,exp}) => {
    sessionStorage.setItem("alloc:active-request", JSON.stringify({
      requestId: id, payer: "payer-fixture", capability: "fake-capability-browser-test", expiresAt: exp,
    }));
  }, {id: quoteId, exp: expiresAt});
  await page.route(`**/api/v1/requests/${quoteId}`, route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ requestId: quoteId, expiresAt, result: null, receipt: null, ...body }),
  }));
}
const receipt = {
  network: "devnet", commitment: "confirmed", slot: 999,
  signature: "fixture-signature-not-real", creatorLamports: "7000000", providerLamports: "3000000",
  creatorAddress: creator, providerAddress: provider, memo: "alloc:v1:" + quoteId,
  explorerUrl: "https://explorer.solana.com/tx/fixture-signature-not-real?cluster=devnet",
};

test("upload and fixed two-recipient quote remain readable at 360, 768, 1440px", async ({page}) => {
  await stubModel(page);
  for (const width of [360,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.getByText("One image. Two beneficiaries.")).toBeVisible();
    await expect(page.getByText("0.010000")).toBeVisible();
    await expect(page.getByText("0.007 SOL")).toBeVisible();
    await expect(page.getByText("0.003 SOL")).toBeVisible();
    await expect(page.getByText("Browse files")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test("client rejects non-image before creating any quote", async ({page}) => {
  await stubModel(page);
  let quoteRequests = 0;
  await page.route("**/api/v1/requests", route => {
    quoteRequests++;
    return route.fulfill({status:500,body:"should not reach"});
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name:"not-an-image.gif", mimeType:"image/gif", buffer:Buffer.from("GIF89a"),
  });
  await expect(page.getByRole("alert")).toContainText("JPEG or PNG");
  expect(quoteRequests).toBe(0);
  await expect(page.getByRole("button", {name:/Validate & lock quote/i})).toBeDisabled();
});

test("pending payment is recoverable and never offers another charge", async ({page}) => {
  await stubModel(page);
  await stubRecoveredRequest(page, {state:"PAYMENT_PENDING", signature:receipt.signature});
  await page.goto("/");
  await expect(page.getByText("Checking Devnet payment. Do not pay again.")).toBeVisible();
  await expect(page.getByText("PAYMENT_PENDING")).toBeVisible();
  await expect(page.getByRole("button", {name:/Check payment/i})).toBeVisible();
  await expect(page.getByRole("button", {name:/New paid request/i})).toHaveCount(0);
  await expect(page.getByRole("button", {name:/Approve payment/i})).toHaveCount(0);
});

test("paid inference failure keeps receipt without a repay button", async ({page}) => {
  await stubModel(page);
  await stubRecoveredRequest(page, {state:"PAID_FAILED", signature:receipt.signature, errorCode:"INFERENCE_UNCERTAIN", receipt});
  await page.goto("/");
  await expect(page.getByText(/Payment verified, but inference failed/)).toBeVisible();
  await expect(page.getByText("Verified receipt")).toBeVisible();
  await expect(page.getByRole("link", {name:/View in Explorer/i})).toHaveAttribute("href",/cluster=devnet/);
  await expect(page.getByRole("button", {name:/Approve payment/i})).toHaveCount(0);
});

test("successful result is displayed with inspectable matching receipt", async ({page}) => {
  await stubModel(page);
  await stubRecoveredRequest(page, {
    state:"SUCCEEDED",signature:receipt.signature,receipt,
    result:{modelId:"mobilenet-v3-small",weightsId:"IMAGENET1K_V1",inferenceMs:42,
      predictions:[{label:"class A",score:0.85},{label:"class B",score:0.10},{label:"class C",score:0.02}]},
  });
  await page.goto("/");
  await expect(page.getByText("Classification result")).toBeVisible();
  await expect(page.getByText("class A")).toBeVisible();
  await expect(page.getByText("85.00%")).toBeVisible();
  await expect(page.getByText("Verified receipt")).toBeVisible();
  await expect(page.getByRole("button", {name:/New paid request/i})).toBeVisible();
});
