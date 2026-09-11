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
  /** Värde och etikett -- det lagrade formatet bär båda ({v, label}). */
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  unit?: string;
  /** Måste fyllas för att orderkoden ska bli komplett. */
  required?: boolean;
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

/**
 * Översätter det LAGRADE schemaformatet till det koden ovan beskriver.
 *
 * De två gick isär: typerna här beskriver steg som INNEHÅLLER fält
 * (`steps[].fields[]`), medan alla fem scheman i config_schemas lagrar steget
 * SOM fältet -- `{id, step, type: "single_select", title, options: [{v,label}]}`.
 *
 * Följden var att `defaultsFromSchema()` körde `for (const f of step.fields)`
 * mot undefined och kastade direkt vid inladdning. Hela
 * /configurator/schema/:id kraschade i produktion med "o.fields is not
 * iterable" -- för samtliga scheman, trots att routen länkas från både
 * komponentsidan och projektsidan.
 *
 * Datan är konsekvent över alla fem scheman, så det är koden som haft fel bild.
 * Normaliseringen görs här i stället för att skriva om schemana, eftersom
 * formatet är det som faktiskt används och en migrering av fem JSON-dokument
 * hade riskerat att tappa fält.
 */
export function normalizeSchema(raw: unknown): ConfigSchemaJson {
  const rawSteps = (raw as { steps?: unknown[] } | null)?.steps;
  if (!Array.isArray(rawSteps)) return { steps: [] };

  const steps: SchemaStep[] = [];
  for (const r of rawSteps) {
    const st = r as Record<string, unknown>;

    // Redan i det beskrivna formatet: lämna orört.
    if (Array.isArray(st.fields)) {
      steps.push(st as unknown as SchemaStep);
      continue;
    }

    const id = String(st.id ?? "");
    if (!id) continue;
    // Det lagrade formatet hade bara ett `title`, och det var skrivet på
    // engelska. Schemaspåret visade därför "Bore diameter" och "Stroke length"
    // mitt på den svenska sidan. `title_sv`/`title_en` läses när de finns;
    // `title` är kvar som reserv för de scheman som ännu bara har ett.
    const title = String(st.title ?? id);
    const titleSv = String(st.title_sv ?? title);
    const titleEn = String(st.title_en ?? title);

    const rawType = String(st.type ?? "text");
    const type: SchemaField["type"] =
      rawType === "numeric" || rawType === "number"
        ? "number"
        : rawType === "boolean"
          ? "boolean"
          : rawType.includes("select")
            ? "select"
            : "text";

    const options = Array.isArray(st.options)
      ? (st.options as Record<string, unknown>[]).map((o) => ({
          value: String(o.v ?? o.value ?? ""),
          label: String(o.label ?? o.v ?? o.value ?? ""),
        }))
      : undefined;

    steps.push({
      id,
      title_en: titleEn,
      title_sv: titleSv,
      fields: [{
        key: id,
        type,
        label_en: titleEn,
        label_sv: titleSv,
        options,
        min: typeof st.min === "number" ? st.min : undefined,
        max: typeof st.max === "number" ? st.max : undefined,
        unit: st.unit ? String(st.unit) : undefined,
        required: st.required === true,
        // Utan default blir select-fältet tomt medan orderkoden redan räknar
        // med ett värde; första alternativet är vad kunden ser valt.
        default: type === "select" ? options?.[0]?.value : undefined,
      }],
    });
  }
  return { steps };
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
    for (const f of step.fields ?? []) {
      if (f.default !== undefined) out[f.key] = f.default;
    }
  }
  return out;
}

/**
 * Bygger kontexten reglerna körs mot.
 *
 * Två konfiguratorspår renderar samma familjer: familjespåret
 * (/configurator/:family, drivet av configurator_params) och schemaspåret
 * (/configurator/schema/:id, drivet av config_schemas.schema_json). Båda kör
 * samma regler ur config_rules, och de MÅSTE därför bygga kontexten likadant.
 *
 * Det gjorde de inte. Familjespåret konverterade numeriska fält till tal och
 * la till `variant`; schemaspåret skickade in formulärets råa värden. Följden
 * var att samtliga 63 DSBC-villkor var döda på schemaspåret -- de är vaktade
 * på `variant`, och `undefined == "base"` är falskt. Reglerna syntes i
 * databasen, gick att granska, och larmade aldrig.
 *
 * `numericKeys` är de fält som ska läsas som tal: reglerna jämför slag > 1500,
 * och utan konverteringen blir "600" > 1500 en strängjämförelse som säger sant.
 */
export function buildRuleContext(
  values: Record<string, unknown>,
  numericKeys: Iterable<string>,
  deriveVariant?: (ctx: Record<string, string | number>) => string,
): Record<string, unknown> {
  const numeric = new Set(numericKeys);
  const ctx: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(values)) {
    const v = Array.isArray(raw) ? raw.join(" ") : (raw ?? "");
    ctx[k] = numeric.has(k) ? Number(v || 0) : v;
  }
  // En beställnyckel kan ha flera utföranden med olika gränser och tillval --
  // DSBC har fyra tabeller. Vilken som gäller framgår av valen själva.
  if (deriveVariant) ctx.variant = deriveVariant(ctx as Record<string, string | number>);
  return ctx;
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
