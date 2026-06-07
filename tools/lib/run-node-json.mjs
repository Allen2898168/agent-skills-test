import { spawnSync } from "node:child_process";
import { parseLastJson } from "./parse-last-json.mjs";

export function runNodeJson(commandArgs, options = {}) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
  });
  return {
    exitCode: result.status ?? 1,
    payload: parseLastJson(result.stdout) || parseLastJson(result.stderr),
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

