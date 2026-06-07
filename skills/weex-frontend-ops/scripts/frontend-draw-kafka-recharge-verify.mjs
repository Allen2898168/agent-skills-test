#!/usr/bin/env node
import { loadFrontendEnv } from './lib/env.mjs';
import { help, parseArgs, resolveConfig } from './business/draw-kafka/cli.mjs';
import { runDrawKafkaRechargeFlow } from './business/draw-kafka/flow.mjs';

loadFrontendEnv();

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(help());
  process.exit(0);
}

const password = process.env.WEEX_FRONTEND_COMMON_PASSWORD || process.env.WEEX_FRONTEND_PASSWORD || '';
const config = resolveConfig(args, password);

if (args.dryRun) {
  console.log(JSON.stringify({
    ok: config.missing.length === 0,
    dryRun: true,
    operation: 'frontend_draw_kafka_recharge_verify',
    activity: { alias: args.activityAlias, id: args.activityId, url: config.drawUrl, taskId: config.taskId },
    account: { email: args.email, uid: args.uid },
    kafka: { url: args.kafkaUrl, amount: config.amount },
    browser: { visible: args.visible, viewport: 'desktop 1440x1000' },
    missingConfig: config.missing.length ? config.missing : null,
    requiresConfirmRun: true
  }, null, 2));
  process.exit(config.missing.length ? 1 : 0);
}

if (!args.confirmRun) {
  console.error('Refusing real execution without --confirm-run.');
  process.exit(1);
}
if (config.missing.length) {
  console.error(`Missing required config: ${config.missing.join(', ')}`);
  process.exit(1);
}

try {
  const result = await runDrawKafkaRechargeFlow({ args, config, password });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    operation: 'frontend_draw_kafka_recharge_verify',
    error: error.message
  }, null, 2));
  process.exitCode = 1;
}
