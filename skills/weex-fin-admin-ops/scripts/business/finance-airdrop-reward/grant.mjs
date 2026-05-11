import {
  DEFAULT_BIZ_TYPE,
  assertBusinessOk,
  discoverFinGrantConfig,
  ensureFinAuthReady,
  postFin,
} from "./api.mjs";
import { grantHelp, parseGrantArgs, validateGrantArgs } from "./cli.mjs";

function printableUid(uid, env = process.env) {
  return (env.WEEX_FIN_ENV || "stg") === "prod" ? "<UID>" : String(uid || "");
}

function createPayload(args, discovered) {
  return {
    coinId: discovered.currency.coinId,
    coinName: discovered.currency.coinName,
    amount: Number(args.amount),
    systemType: 1,
    userId: Number(args.uid),
    params1: args.remark1 || `auto grant ${new Date().toISOString()}`,
    subBizType: discovered.subBiz.subBizType,
    systemUserId: discovered.subBiz.systemUserId,
  };
}

function buildPlan(args, auth, discovered, payload, env) {
  return {
    bizType: DEFAULT_BIZ_TYPE,
    pageUrl: auth.url,
    uid: printableUid(args.uid, env),
    amount: args.amount,
    currency: discovered.currency,
    subBiz: discovered.subBiz,
    auditType: discovered.auditType,
    createPayload: payload ? { ...payload, userId: printableUid(payload.userId, env) } : null,
    approve: args.confirmApprove,
    create: args.confirmCreate,
  };
}

async function findCreatedOrder(auth, args, payload, createResponse) {
  const directOrderId = createResponse.data?.orderId || createResponse.data?.id;
  const body = {
    pageNum: 1,
    pageSize: 10,
    status: 1,
    userId: String(args.uid),
    params: payload.params1,
    coinId: String(payload.coinId),
  };
  if (directOrderId) body.orderId = directOrderId;
  const response = await postFin(auth, `/admin/fin/asset/adjust/listOrderNew/${DEFAULT_BIZ_TYPE}`, body);
  assertBusinessOk(response, "listOrderNew after create");
  const records = response.data?.records || [];
  const matched = records.find(item => (!directOrderId || String(item.orderId) === String(directOrderId))
    && String(item.userId) === String(args.uid)
    && String(item.coinName).toUpperCase() === String(payload.coinName).toUpperCase());
  if (!matched) throw new Error("Created order was not found in wait-audit list");
  return matched;
}

function approvalPayload(args, order, discovered, verifyCode) {
  const payload = {
    orderIds: [order.orderId],
    reason: discovered.auditType.value,
    auditRemarkCode: args.auditRemark || "auto approve",
    checkInfoDTO: [{
      amount: order.amount,
      coinId: order.coinId,
      coinName: order.coinName,
      systemUserId: order.systemUserId,
      userId: order.userId,
    }],
    businessAttribute: 0,
    oldStatus: 1,
    status: 3,
  };
  if (verifyCode) payload.verifyCode = verifyCode;
  return payload;
}

async function createOrLoadOrder(auth, args, payload) {
  if (args.approveOnlyOrderId) {
    const response = await postFin(auth, `/admin/fin/asset/adjust/listOrderNew/${DEFAULT_BIZ_TYPE}`, {
      pageNum: 1,
      pageSize: 10,
      status: 1,
      orderId: args.approveOnlyOrderId,
    });
    assertBusinessOk(response, "listOrderNew approve-only");
    const order = response.data?.records?.find(item => String(item.orderId) === String(args.approveOnlyOrderId));
    if (!order) throw new Error("Approve-only order was not found in wait-audit list");
    return order;
  }
  const createResponse = await postFin(auth, `/admin/fin/asset/adjust/createGrantOrder/${DEFAULT_BIZ_TYPE}`, payload);
  assertBusinessOk(createResponse, "createGrantOrder");
  return findCreatedOrder(auth, args, payload, createResponse);
}

async function approveOrder(auth, args, order, discovered, env) {
  const needGaResponse = await postFin(auth, `/admin/fin/asset/adjust/needGaVerify/${DEFAULT_BIZ_TYPE}`, approvalPayload(args, order, discovered));
  assertBusinessOk(needGaResponse, "needGaVerify");
  const verifyCode = env.WEEX_FIN_GOOGLE_CODE;
  const approveResponse = await postFin(auth, `/admin/fin/asset/adjust/verifyPass/${DEFAULT_BIZ_TYPE}`, approvalPayload(args, order, discovered, verifyCode));
  assertBusinessOk(approveResponse, "verifyPass");
  const verifyList = await postFin(auth, `/admin/fin/asset/adjust/listOrderNew/${DEFAULT_BIZ_TYPE}`, {
    pageNum: 1,
    pageSize: 10,
    orderId: order.orderId,
    status: 3,
  });
  assertBusinessOk(verifyList, "listOrderNew after approve");
  const approvedListHit = Boolean(verifyList.data?.records?.find(item => String(item.orderId) === String(order.orderId)));
  let pendingListHitAfterApprove = null;
  if (!approvedListHit) {
    const pendingList = await postFin(auth, `/admin/fin/asset/adjust/listOrderNew/${DEFAULT_BIZ_TYPE}`, {
      pageNum: 1,
      pageSize: 10,
      orderId: order.orderId,
      status: 1,
    });
    assertBusinessOk(pendingList, "listOrderNew pending check after approve");
    pendingListHitAfterApprove = Boolean(pendingList.data?.records?.find(item => String(item.orderId) === String(order.orderId)));
  }
  return {
    needGaVerify: Boolean(needGaResponse.data),
    approvedListHit,
    pendingListHitAfterApprove,
    approvalVerified: approvedListHit || pendingListHitAfterApprove === false,
  };
}

export async function runFinanceAirdropRewardGrant(argv, env = process.env) {
  const args = parseGrantArgs(argv, env);
  if (args.help) {
    process.stdout.write(`${grantHelp()}\n`);
    return;
  }
  validateGrantArgs(args, env);

  const { auth } = await ensureFinAuthReady(args.cdpUrl, env);
  const discovered = await discoverFinGrantConfig(auth, args);
  const payload = args.approveOnlyOrderId ? null : createPayload(args, discovered);
  const plan = buildPlan(args, auth, discovered, payload, env);

  if (args.dryRun || (!args.confirmCreate && !args.approveOnlyOrderId)) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      operation: "finance_airdrop_reward_grant",
      plan,
      confirmRequired: ["--confirm-create for order creation", "--confirm-approve plus WEEX_FIN_GOOGLE_CODE for approval"],
    }, null, 2));
    return;
  }

  const order = await createOrLoadOrder(auth, args, payload);
  const approveEvidence = args.confirmApprove ? await approveOrder(auth, args, order, discovered, env) : null;
  console.log(JSON.stringify({
    ok: true,
    operation: "finance_airdrop_reward_grant",
    finalUrl: auth.url,
    order: {
      orderId: order.orderId,
      status: order.status,
      statusDesc: order.statusDesc,
      uid: printableUid(order.userId, env),
      coinName: order.coinName,
      amount: order.amount,
      subBizType: order.subBizType,
    },
    approveEvidence,
  }, null, 2));
}
