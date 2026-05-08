import fs from "node:fs";

export function parseFlags(argv, options = {}) {
  const booleans = new Set(options.booleans || []);
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (booleans.has(arg)) {
      result[toCamel(arg.slice(2))] = true;
    } else if (arg.startsWith("--")) {
      const key = toCamel(arg.slice(2));
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      result[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
