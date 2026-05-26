import { chromium } from "playwright";
import { buildMqRechargePayload, mqRechargeHelp, parseMqRechargeArgs, validateMqRechargeArgs } from "./cli.mjs";

function buildPlan(args, payload) {
  return {
    kafkaUrl: args.kafkaUrl,
    uid: args.uid,
    amount: String(args.amount),
    mode: args.visible ? "visible" : "headless",
    payload,
    assertions: [
      "Kafka messages produce API returns HTTP 200",
      "page shows Success / Message successfully sent",
      "message list can be reloaded and searched by generated message id",
    ],
  };
}

function assertSent(result) {
  if (!result.request?.postData) throw new Error("Kafka produce request was not captured");
  if (result.request.postData.includes("\"content\":null")) throw new Error("Kafka produce request content is null");
  if (result.response?.status !== 200) throw new Error(`Kafka produce response status is ${result.response?.status ?? "unknown"}`);
  if (!result.successText) throw new Error("Kafka UI did not show success text after submit");
  if (!result.foundMessageId) throw new Error("Produced message id was not found in the reloaded message list");
}

async function sendMqRecharge(args, payload) {
  const browser = await chromium.launch({
    headless: !args.visible,
    slowMo: args.visible ? 80 : 0,
  });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  const requestLog = { request: null, response: null };
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (!request.url().includes("/api/clusters/") || !request.url().includes("/messages")) return;
    requestLog.request = { url: request.url(), method: request.method(), postData: request.postData() };
  });
  page.on("response", async (response) => {
    if (response.request().method() !== "POST") return;
    if (!response.url().includes("/api/clusters/") || !response.url().includes("/messages")) return;
    let body = "";
    try { body = await response.text(); } catch {}
    requestLog.response = { url: response.url(), status: response.status(), body };
  });
  try {
    await page.goto(args.kafkaUrl, { waitUntil: "domcontentloaded", timeout: Number(args.timeoutMs) });
    const openButton = page.getByRole("button", { name: /Produce Message/i }).first();
    await openButton.waitFor({ timeout: Number(args.timeoutMs) });
    await openButton.click();
    await page.locator("#content").waitFor({ timeout: Number(args.timeoutMs) });
    const content = JSON.stringify(payload, null, 2);
    await page.evaluate((input) => {
      const setEditor = (id, value) => {
        const root = document.getElementById(id);
        if (!root) throw new Error(`ace root #${id} not found`);
        const editor = window.ace.edit(root);
        editor.setValue(value, -1);
        return editor.getValue();
      };
      setEditor("key", "");
      setEditor("content", input);
      setEditor("headers", "{}");
    }, content);
    const submitButton = page.getByRole("button", { name: /Produce Message/i }).last();
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();
    await page.waitForTimeout(2500);
    const successText = await page.getByText("Message successfully sent").first().isVisible().catch(() => false);
    await page.reload({ waitUntil: "domcontentloaded", timeout: Number(args.timeoutMs) });
    await page.waitForTimeout(2500);
    const deadline = Date.now() + 20_000;
    let foundMessageId = false;
    while (!foundMessageId && Date.now() < deadline) {
      foundMessageId = await page
        .evaluate((messageId) => document.documentElement.textContent?.includes(String(messageId)) ?? false, payload.after.id)
        .catch(() => false);
      if (foundMessageId) break;
      await page.waitForTimeout(1000);
    }
    return {
      finalUrl: page.url(),
      request: requestLog.request,
      response: requestLog.response,
      successText,
      foundMessageId,
    };
  } finally {
    await browser.close();
  }
}

export async function runMqRechargeCallbackSend(argv, env = process.env) {
  const args = parseMqRechargeArgs(argv, env);
  if (args.help) {
    process.stdout.write(`${mqRechargeHelp()}\n`);
    return;
  }
  validateMqRechargeArgs(args);
  const payload = buildMqRechargePayload(args);
  const plan = buildPlan(args, payload);
  if (args.dryRun || !args.confirmSend) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      operation: "mq_recharge_callback_send",
      plan,
      confirmRequired: ["--confirm-send for real Kafka message production"],
    }, null, 2));
    return;
  }
  const result = await sendMqRecharge(args, payload);
  assertSent(result);
  console.log(JSON.stringify({
    ok: true,
    operation: "mq_recharge_callback_send",
    finalUrl: result.finalUrl,
    uid: args.uid,
    amount: String(args.amount),
    messageId: payload.after.id,
    request: result.request,
    response: result.response,
    successText: result.successText,
    foundMessageId: result.foundMessageId,
  }, null, 2));
}
