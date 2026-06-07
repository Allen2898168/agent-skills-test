import { buildFrontendAuthCookie } from '../../lib/login-tool-adapter.mjs';
import { launchBrowser } from '../../lib/browser.mjs';
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function buildKafkaValue({ bizId, uid, amount }) {
  const now = Date.now();
  return JSON.stringify({
    before: null,
    after: {
      id: bizId,
      uid,
      user_id: uid,
      member_id: uid,
      coin_id: 2,
      amount,
      biz_type: 1,
      biz_sub_type: 1,
      status: 9,
      created_time: now,
      updated_time: now
    }
  });
}
function findRechargeCompletion(taskCompletions, taskId) {
  const completions = taskCompletions?.data?.completions;
  if (!Array.isArray(completions)) return null;
  return completions.find(item => String(item?.taskId) === String(taskId) || item?.type === 'RECHARGE') || null;
}
async function buildCookieWithRetry({ email, password, targetUrl, timeoutMs, retries = 4 }) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await buildFrontendAuthCookie({ username: email, password, targetUrl, timeoutMs });
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      if (!message.includes('20105') && attempt >= 2) break;
      await sleep(attempt * 1500);
    }
  }
  throw lastError;
}
async function ensureSignup(page, network, drawUrl, timeoutMs) {
  let seenButton = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const button = page.locator('button:visible').filter({ hasText: '立即报名' }).first();
    if (await button.isVisible().catch(() => false)) {
      seenButton = true;
      await button.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2200);
    }
    const applyOk = network.apply.some(entry => entry?.body?.code === '00000');
    const statusTrue = network.applyStatus.some(entry => entry?.body?.data === true);
    const signedText = await page.getByText('已报名').first().isVisible().catch(() => false);
    if (applyOk || statusTrue || signedText) {
      return { done: true, seenButton, applyOk, applyStatusTrue: statusTrue, applyCalls: network.apply.length, applyStatusCalls: network.applyStatus.length };
    }
    await page.goto(drawUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(2500);
  }
  return {
    done: false,
    seenButton,
    applyOk: network.apply.some(entry => entry?.body?.code === '00000'),
    applyStatusTrue: network.applyStatus.some(entry => entry?.body?.data === true),
    applyCalls: network.apply.length,
    applyStatusCalls: network.applyStatus.length
  };
}
async function sendKafkaCallback(page, { kafkaUrl, payload, timeoutMs }) {
  await page.goto(kafkaUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForTimeout(2500);
  const firstProduce = page.locator('button:visible').filter({ hasText: 'Produce Message' }).first();
  await firstProduce.waitFor({ state: 'visible', timeout: 20000 });
  await firstProduce.click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  await page.waitForFunction(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility !== 'hidden';
    return [...document.querySelectorAll('.ace_editor')].filter(visible).length > 0;
  }, { timeout: 20000 });
  const setResult = await page.evaluate((value) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility !== 'hidden';
    const editors = [...document.querySelectorAll('.ace_editor')].filter(visible);
    const valueEditor = editors[1] || editors[0];
    const ace = valueEditor?.env?.editor;
    if (!ace) return { ok: false, reason: 'ace_editor_missing', count: editors.length };
    ace.setValue(value, -1);
    ace.clearSelection();
    return { ok: true, count: editors.length };
  }, payload);
  const producePromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && response.url().includes('/api/clusters/')
    && response.url().includes('/messages')
  ), { timeout: timeoutMs }).catch(() => null);
  const modalProduce = page.locator('button:visible').filter({ hasText: 'Produce Message' }).last();
  await modalProduce.click({ force: true });
  const response = await producePromise;
  return { setResult, httpStatus: response?.status?.() || null, responseUrl: response?.url?.() || null };
}
async function verifyCompletion(page, network, { drawUrl, taskId, timeoutMs, rounds = 18 }) {
  for (let attempt = 0; attempt < rounds; attempt += 1) {
    await page.goto(drawUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(4200);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(4200);
    const task = findRechargeCompletion(network.taskCompletions, taskId);
    const count = Number(network.frequency?.data?.doTaskGetCount || 0);
    if (task?.status === 'COMPLETED' && count > 0) {
      return { done: true, rounds: attempt + 1, task, frequency: network.frequency, finalUrl: page.url() };
    }
  }
  return {
    done: false,
    rounds,
    task: findRechargeCompletion(network.taskCompletions, taskId),
    frequency: network.frequency,
    finalUrl: page.url()
  };
}
export async function runDrawKafkaRechargeFlow({ args, config, password }) {
  const cookie = await buildCookieWithRetry({
    email: args.email,
    password,
    targetUrl: config.drawUrl,
    timeoutMs: config.timeoutMs
  });
  const { browser, context, page } = await launchBrowser({ visible: args.visible, disableWebSecurity: true });
  const network = { apply: [], applyStatus: [], taskCompletions: null, frequency: null };
  page.on('response', async response => {
    const url = response.url();
    let body = null;
    try { body = await response.json(); } catch {}
    if (url.includes('/v1/activity/general/apply?')) network.apply.push({ status: response.status(), body });
    if (url.includes('/v1/activity/general/applyStatus?')) network.applyStatus.push({ status: response.status(), body });
    if (url.includes('/v1/activity/general/taskCompletions?')) network.taskCompletions = body;
    if (url.includes('/v1/activity/general/raffle/frequency?')) network.frequency = body;
  });
  try {
    await context.addCookies([cookie]);
    await page.goto(config.drawUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
    await page.waitForTimeout(3000);
    const signup = await ensureSignup(page, network, config.drawUrl, config.timeoutMs);
    const firstBizId = Number(String(Date.now()).slice(-10));
    const firstSend = await sendKafkaCallback(page, {
      kafkaUrl: args.kafkaUrl,
      payload: buildKafkaValue({ bizId: firstBizId, uid: config.uid, amount: config.amount }),
      timeoutMs: config.timeoutMs
    });
    let verification = await verifyCompletion(page, network, { drawUrl: config.drawUrl, taskId: config.taskId, timeoutMs: config.timeoutMs, rounds: 18 });
    let second = null;
    if (!verification.done) {
      const secondBizId = Number(String(Date.now() + 13).slice(-10));
      second = {
        bizId: secondBizId,
        ...(await sendKafkaCallback(page, {
          kafkaUrl: args.kafkaUrl,
          payload: buildKafkaValue({ bizId: secondBizId, uid: config.uid, amount: config.amount }),
          timeoutMs: config.timeoutMs
        }))
      };
      verification = await verifyCompletion(page, network, { drawUrl: config.drawUrl, taskId: config.taskId, timeoutMs: config.timeoutMs, rounds: 18 });
    }
    return {
      ok: verification.done,
      operation: 'frontend_draw_kafka_recharge_verify',
      activity: { alias: args.activityAlias, id: Number(args.activityId), url: config.drawUrl, taskId: config.taskId },
      account: { email: args.email, uid: args.uid },
      signup,
      kafka: { first: { bizId: firstBizId, ...firstSend }, second },
      completion: {
        status: verification.task?.status || null,
        taskId: verification.task?.taskId || null,
        type: verification.task?.type || null,
        netRechargeAmount: verification.task?.taskData?.netRechargeAmount ?? verification.task?.netRechargeAmount ?? null,
        totalRechargeAmount: verification.task?.taskData?.totalRechargeAmount ?? verification.task?.totalRechargeAmount ?? null,
        netRechargeAchieveTime: verification.task?.taskData?.netRechargeAchieveTime ?? verification.task?.netRechargeAchieveTime ?? null,
        doTaskGetCount: verification.frequency?.data?.doTaskGetCount ?? null,
        rounds: verification.rounds
      },
      final: { url: verification.finalUrl, viewport: page.viewportSize() },
      evidence: {
        applyCalls: network.apply.slice(-3),
        applyStatusCalls: network.applyStatus.slice(-3),
        taskCompletions: network.taskCompletions,
        frequency: network.frequency
      }
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
