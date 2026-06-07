import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const schemaRoot = path.resolve(path.dirname(currentFile), "../schemas");

export function loadSchema(fileName) {
  return JSON.parse(fs.readFileSync(path.join(schemaRoot, fileName), "utf8"));
}

export function validateValue(value, schema, rootSchema = schema, location = "$") {
  const errors = [];
  const resolved = resolveRef(schema, rootSchema);
  if (!resolved) return [`${location}: unresolved schema reference`];
  if (resolved.type) {
    const typeErrors = validateType(value, resolved.type, location);
    errors.push(...typeErrors);
    if (typeErrors.length) return errors;
  }
  if (resolved.enum && !resolved.enum.includes(value)) {
    errors.push(`${location}: expected one of ${resolved.enum.join(", ")}`);
  }
  if (Object.prototype.hasOwnProperty.call(resolved, "const") && value !== resolved.const) {
    errors.push(`${location}: expected constant ${JSON.stringify(resolved.const)}`);
  }
  if (typeof value === "string" && resolved.minLength && value.length < resolved.minLength) {
    errors.push(`${location}: expected minLength ${resolved.minLength}`);
  }
  if (Array.isArray(value)) {
    if (resolved.minItems && value.length < resolved.minItems) {
      errors.push(`${location}: expected minItems ${resolved.minItems}`);
    }
    if (resolved.items) {
      value.forEach((item, index) => {
        errors.push(...validateValue(item, resolved.items, rootSchema, `${location}[${index}]`));
      });
    }
  }
  if (isPlainObject(value)) {
    const required = resolved.required || [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${location}.${key}: missing required property`);
      }
    }
    const properties = resolved.properties || {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      errors.push(...validateValue(value[key], propSchema, rootSchema, `${location}.${key}`));
    }
    if (resolved.additionalProperties === false) {
      const allowed = new Set(Object.keys(properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${location}.${key}: additional property is not allowed`);
      }
    }
  }
  return errors;
}

function validateType(value, type, location) {
  const types = Array.isArray(type) ? type : [type];
  const ok = types.some(item => matchesType(value, item));
  return ok ? [] : [`${location}: expected type ${types.join("|")}`];
}

function matchesType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isPlainObject(value);
  if (type === "string") return typeof value === "string";
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  return false;
}

function resolveRef(schema, rootSchema) {
  if (!schema || typeof schema !== "object") return schema;
  if (!schema.$ref) return schema;
  if (!schema.$ref.startsWith("#/")) return null;
  const parts = schema.$ref.slice(2).split("/");
  let current = rootSchema;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) return null;
  }
  return current;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
