export function matchAction(manifest, args) {
  if (args.action) {
    const action = manifest.actions.find(item => item.id === args.action);
    if (!action) throw new Error(`Cached action not found: ${args.action}`);
    return { action, inferred: {} };
  }
  if (!args.query) throw new Error("Provide --query or --action");
  const candidates = manifest.actions
    .map(action => ({ action, score: scoreAction(action, args.query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) throw new Error(`No cached action matched query: ${args.query}`);
  return {
    action: candidates[0].action,
    inferred: inferFinanceAirdropGrantParams(args.query),
    score: candidates[0].score,
  };
}

function scoreAction(action, query) {
  let score = 0;
  if (hasAny(query, action.intentKeywords || [])) score += 2;
  if (hasAny(query, action.objectKeywords || [])) score += 2;
  if (action.id === "register_recharge_transfer_contract" && /创建|注册/i.test(query) && /账号/i.test(query) && /合约|转进|转入|划转/i.test(query)) score += 30;
  if (action.id === "create_api_account_fund_contract_order" && /创建|申请|生成/i.test(query) && /API账号|API账户|带API|api/i.test(query) && /下单|多单|空单|开多|开空|order|合约/i.test(query)) score += 36;
  if (action.id === "fin_system_account_create" && /创建|申请|生成/i.test(query) && /系统账号|系统账户|API账号|API账户|带API|api/i.test(query)) score += 28;
  if (action.id === "batch_register_recharge" && /创建|注册/i.test(query) && /账号/i.test(query) && /充值|发放|下发/i.test(query)) score += 20;
  if (action.id === "finance_airdrop_reward_grant" && /充值|发放|下发|增加|空投奖励|财务|FIN/i.test(query) && /自动化|跑通|创建|审核|通过|USDT/i.test(query)) score += 14;
  return score;
}

function inferFinanceAirdropGrantParams(query) {
  if (!/充值|发放|下发|增加|空投奖励|财务|FIN|合约|转进|转入|划转|系统账号|系统账户|API账号|API账户|带API|api/i.test(query)) return {};
  const uidMatch = query.match(/(?:uid|UID|目标账号uid|目标UID|目标账号)\s*(?:用|为|是|=|:|：)?\s*(\d+)/);
  const amountMatch = query.match(/(?:数量|金额|amount)\s*(?:用|为|是|=|:|：)?\s*(\d+(?:\.\d+)?)/i)
    || query.match(/(\d+(?:\.\d+)?)\s*(?:U|USDT)\b/i);
  const symbolMatch = query.match(/\b([A-Z]{2,10})(?:USDT|USD)\b/i)
    || query.match(/\b(eth|btc|sol|xrp|doge)\b/i);
  const currencyMatch = query.match(/(?:币种|currency)\s*(?:用|为|是|=|:|：)?\s*([A-Za-z0-9]+)/i)
    || query.match(/\d+(?:\.\d+)?\s*(U|USDT)\b/i);
  const orderMatch = query.match(/(?:订单ID|orderId|order id)\s*(?:用|为|是|=|:|：)?\s*([A-Za-z0-9_-]+)/i);
  const countMatch = query.match(/(?:创建|注册|生成|申请)?\s*(\d+)\s*个(?:.*?)账号/);
  const concurrencyMatch = query.match(/(?:并发|concurrency)\s*(?:用|为|是|=|:|：)?\s*(\d+)/i);
  const emailPrefixMatch = query.match(/(?:邮箱前缀|email-prefix|emailPrefix)\s*(?:用|为|是|=|:|：)?\s*([A-Za-z0-9_-]+)/i);
  const userTypeMatch = query.match(/(?:用户类型|user-type|userType)\s*(?:用|为|是|=|:|：)?\s*([A-Za-z0-9_-]+)/i);
  const remarkMatch = query.match(/(?:备注|remark)\s*(?:用|为|是|=|:|：)?\s*([A-Za-z0-9_-]+)/i);
  const isBatchRegisterRecharge = /创建|注册/i.test(query) && /账号/i.test(query) && /充值|发放|下发/i.test(query);
  const isContractFunding = /创建|注册/i.test(query) && /账号/i.test(query) && /合约|转进|转入|划转/i.test(query);
  const isApiAccountOrder = /创建|申请|生成/i.test(query) && /API账号|API账户|带API|api/i.test(query) && /下单|多单|空单|开多|开空|order|合约/i.test(query);
  return {
    uid: uidMatch?.[1],
    amount: amountMatch?.[1],
    currency: currencyMatch?.[1]?.toUpperCase() === "U" ? "USDT" : currencyMatch?.[1],
    count: countMatch?.[1] || (/一\s*个账号|一个账号|创建个.*账号|创建.*个带API/i.test(query) ? "1" : undefined),
    concurrency: concurrencyMatch?.[1],
    emailPrefix: emailPrefixMatch?.[1],
    userType: userTypeMatch?.[1],
    remark: remarkMatch?.[1],
    fundAmount: query.match(/(?:保证金|充值|发放|fund)\s*(?:用|为|是|=|:|：)?\s*(\d+(?:\.\d+)?)/i)?.[1],
    orderNotional: amountMatch?.[1],
    symbol: symbolMatch?.[1] ? `${symbolMatch[1].toUpperCase().replace(/USDT|USD/i, "")}USDT` : undefined,
    side: /空单|开空|SHORT|SELL/i.test(query) ? "SELL" : /多单|开多|LONG|BUY/i.test(query) ? "BUY" : undefined,
    positionSide: /空单|开空|SHORT/i.test(query) ? "SHORT" : /多单|开多|LONG/i.test(query) ? "LONG" : undefined,
    subBizType: query.includes("其他活动") ? "OTHER_ACTIVITIES" : undefined,
    approveOnlyOrderId: orderMatch?.[1],
    confirmCreate: /确认创建|真实创建|执行创建/.test(query),
    saveSecrets: /保存密钥|保存凭证|保存结果|API账号|API账户|带API|api/i.test(query),
    confirmApprove: /确认审核|审核通过|执行通过|真实通过/.test(query),
    confirmRegister: isBatchRegisterRecharge || isContractFunding || /确认注册|真实注册|执行注册/.test(query),
    confirmRecharge: isBatchRegisterRecharge || isContractFunding || /确认充值|真实充值|执行充值|确认发放|执行发放/.test(query),
    confirmTransfer: isContractFunding || /确认划转|真实划转|执行划转|转入合约|转进合约/.test(query),
    confirmCreateAccount: isApiAccountOrder || /确认创建|真实创建|执行创建/.test(query),
    confirmOrder: isApiAccountOrder || /确认下单|真实下单|执行下单|开多|开空|多单|空单/.test(query),
    ...(isApiAccountOrder ? { confirmRecharge: true, confirmTransfer: true } : {}),
    allowUnverifiedTransferChain: isContractFunding,
  };
}

function hasAny(query, words) {
  return words.some(word => query.toUpperCase().includes(String(word).toUpperCase()));
}
