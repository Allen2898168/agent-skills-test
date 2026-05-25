#!/usr/bin/env node
import { printJson } from "../../../orchestrations/lottery-regression/lib/cli.mjs";
import {
  loadLotteryRegressionManifest,
  buildScenarioMenu,
} from "../../../orchestrations/lottery-regression/lib/lottery-regression-manifest.mjs";

function usage() {
  return `Usage:
  node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --menu

Prints the current lottery regression scenario menu grouped by lane and annotated with executable status.`;
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(`${usage()}\n`);
  process.exit(0);
}

const manifest = loadLotteryRegressionManifest();
const menu = buildScenarioMenu(manifest);

printJson({
  ok: true,
  actionId: "lottery_regression_menu",
  generatedAt: new Date().toISOString(),
  executionPolicy: manifest.executionPolicy,
  groups: menu,
});
