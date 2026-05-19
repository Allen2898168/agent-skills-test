import { chromium } from "playwright";
import { buildMqRechargePayload, mqRechargeHelp, parseMqRechargeArgs, validateMqRechargeArgs } from "./cli.mjs";

function buildPlan(args, payload) {
  return {
    kafkaUrl: args.kafkaUrl,
    uid: args.uid,
    amount: String(args.amount),
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
  const browser = await chromium.launch({ headless: true });
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
    await page.waitForTimeout(1500);
    const content = JSON.stringify(payload, null, 2);
    await page.evaluate((input) => {
      const setEditor = (id, value) => {
        const editor = window.ace.edit(id);
        editor.setValue(value, -1);
        return editor.getValue();
      };
      setEditor("key", "");
      setEditor("content", input);
      setEditor("headers", "{}");
      const form = document.querySelector("form");
      const button = form && [...form.querySelectorAll("button")].find((item) => /Produce Message/.test(item.innerText || item.textContent || ""));
      if (!button) throw new Error("produce button not found");
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }, content);
    await page.waitForTimeout(2500);
    const successText = await page.getByText("Message successfully sent").first().isVisible().catch(() => false);
    await page.reload({ waitUntil: "domcontentloaded", timeout: Number(args.timeoutMs) });
    await page.waitForTimeout(2500);
    const foundMessageId = await page.evaluate((messageId) => document.body.innerText.includes(String(messageId)), payload.after.id);
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
