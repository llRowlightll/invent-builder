// Tiny JSON-logic-ish evaluator for configurator rules.
// Supported ops: ==, !=, <, <=, >, >=, and, or, not, var, in
export type LogicNode =
  | { var: string }
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null;

export function evalLogic(node: unknown, ctx: Record<string, unknown>): unknown {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => evalLogic(n, ctx));
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return obj;
  const op = keys[0];
  const args = obj[op];
  const argArr = Array.isArray(args) ? args.map((a) => evalLogic(a, ctx)) : [evalLogic(args, ctx)];
  switch (op) {
    case "var": {
      const k = String(argArr[0]);
      return k.split(".").reduce<unknown>((a, p) => (a && typeof a === "object" ? (a as Record<string, unknown>)[p] : undefined), ctx);
    }
    case "==": return argArr[0] == argArr[1];
    case "!=": return argArr[0] != argArr[1];
    case "<": return Number(argArr[0]) < Number(argArr[1]);
    case "<=": return Number(argArr[0]) <= Number(argArr[1]);
    case ">": return Number(argArr[0]) > Number(argArr[1]);
    case ">=": return Number(argArr[0]) >= Number(argArr[1]);
    case "and": return argArr.every(Boolean);
    case "or": return argArr.some(Boolean);
    case "not": return !argArr[0];
    case "in": return Array.isArray(argArr[1]) && (argArr[1] as unknown[]).includes(argArr[0]);
    default: return false;
  }
}

export interface SchemaField {
  key: string;
  type: "number" | "select" | "boolean" | "text";
  label_en: string;
  label_sv: string;
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
}
export interface SchemaStep {
  id: string;
  title_en: string;
  title_sv: string;
  fields: SchemaField[];
}
export interface ConfigSchemaJson {
  steps: SchemaStep[];
}

export interface ConfigRule {
  id: string;
  schema_id: string;
  severity: "error" | "warn" | "info";
  if_json: unknown;
  message_en: string;
  message_sv: string;
  goto_step: string | null;
}

export interface ValidationMessage {
  level: "error" | "warn" | "info";
  message: string;
  goto_step: string | null;
}

export function defaultsFromSchema(schema: ConfigSchemaJson): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.default !== undefined) out[f.key] = f.default;
    }
  }
  return out;
}

export function validate(
  rules: ConfigRule[],
  values: Record<string, unknown>,
  locale: string,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const r of rules) {
    if (evalLogic(r.if_json, values)) {
      out.push({
        level: r.severity,
        message: locale === "sv" ? r.message_sv : r.message_en,
        goto_step: r.goto_step,
      });
    }
  }
  return out;
}

export function buildOrderCode(schemaId: string, values: Record<string, unknown>): string {
  const parts = [
    schemaId,
    String(values.mode ?? "best").toUpperCase(),
    values.stroke_mm ?? "X",
    values.force_n ?? "X",
    String(values.feedback ?? "X").slice(0, 3).toUpperCase(),
    String(values.fieldbus ?? "X").slice(0, 3).toUpperCase(),
    String(values.voltage ?? "X").replace("VAC", ""),
  ];
  return parts.join("-");
}
