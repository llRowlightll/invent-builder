/**
 * Schemakonfiguratorns motor.
 *
 * Bakgrund: /configurator/schema/:id kraschade i produktion för SAMTLIGA fem
 * scheman med "o.fields is not iterable", och hade gjort det ända sedan
 * schemana lades in. Typerna i configurator-engine.ts beskrev steg som
 * INNEHÅLLER fält (`steps[].fields[]`), medan datan lagrar steget SOM fältet.
 * `defaultsFromSchema()` körde `for (const f of step.fields)` mot undefined.
 *
 * Ingenting fångade det: routen är länkad från komponentsidan och
 * projektsidan, men inget test laddade ett verkligt schema.
 *
 * Fixturerna nedan är kopierade ur config_schemas och ska hållas i takt med
 * dem -- det är formatet som faktiskt körs som räknas, inte det som beskrivs.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  defaultsFromSchema,
  evalLogic,
  normalizeSchema,
  validate,
  type ConfigRule,
} from "../../../src/lib/configurator-engine.ts";

/** Utdrag ur SCHEMA-CQ2-V1, ordagrant som det ligger i databasen. */
const LAGRAT_SCHEMA = {
  version: "1.0",
  steps: [
    {
      id: "bore",
      step: 1,
      type: "single_select",
      title: "Bore diameter",
      options: [
        { v: 12, label: "Ø12mm", force_N_5bar: 57 },
        { v: 16, label: "Ø16mm", force_N_5bar: 100 },
        { v: 20, label: "Ø20mm", force_N_5bar: 157 },
      ],
    },
    { id: "stroke", step: 2, type: "numeric", unit: "mm", min: 1, max: 1000, title: "Stroke length (mm)" },
    {
      id: "action",
      step: 3,
      type: "single_select",
      title: "Cylinder action",
      options: [
        { v: "double", label: "Double acting (standard)" },
        { v: "single_ext", label: "Single acting – spring extend" },
      ],
    },
  ],
};

Deno.test("det lagrade formatet går att normalisera utan att kasta", () => {
  const s = normalizeSchema(LAGRAT_SCHEMA);
  assertEquals(s.steps.length, 3);
  for (const step of s.steps) {
    assert(Array.isArray(step.fields), `steg "${step.id}" saknar fields`);
    assertEquals(step.fields.length, 1, "steget ÄR fältet i det lagrade formatet");
  }
});

Deno.test("defaultsFromSchema kastar inte längre på ett verkligt schema", () => {
  // Exakt anropet som fällde produktionen.
  const v = defaultsFromSchema(normalizeSchema(LAGRAT_SCHEMA));
  assertEquals(v.bore, "12", "första alternativet är förvalt");
  assertEquals(v.action, "double");
});

Deno.test("typerna översätts till dem FieldInput kan rendera", () => {
  const s = normalizeSchema(LAGRAT_SCHEMA);
  const byId = (id: string) => s.steps.find((x) => x.id === id)!.fields[0];
  assertEquals(byId("bore").type, "select", "single_select -> select");
  assertEquals(byId("stroke").type, "number", "numeric -> number");
  assertEquals(byId("stroke").min, 1);
  assertEquals(byId("stroke").max, 1000);
  assertEquals(byId("stroke").unit, "mm");
});

Deno.test("alternativen behåller både värde och etikett", () => {
  // Den gamla typen var string[], vilket hade tappat "Ø12mm" och visat "12".
  const bore = normalizeSchema(LAGRAT_SCHEMA).steps[0].fields[0];
  assertEquals(bore.options, [
    { value: "12", label: "Ø12mm" },
    { value: "16", label: "Ø16mm" },
    { value: "20", label: "Ø20mm" },
  ]);
});

Deno.test("ett schema som redan har fields lämnas orört", () => {
  const redan = {
    steps: [{
      id: "x", title_en: "X", title_sv: "X",
      fields: [{ key: "x", type: "number", label_en: "X", label_sv: "X" }],
    }],
  };
  assertEquals(normalizeSchema(redan).steps[0].fields[0].key, "x");
});

Deno.test("trasig indata ger ett tomt schema i stället för ett kast", () => {
  for (const bad of [null, undefined, {}, { steps: "nope" }, { steps: [{}] }]) {
    const s = normalizeSchema(bad);
    assert(Array.isArray(s.steps), `${JSON.stringify(bad)} gav inget schema`);
  }
});

// ── Regelmotorn ──────────────────────────────────────────────────────────────

Deno.test("evalLogic: ett villkor med flera nycklar är INTE ett villkor", () => {
  // Reglerna låg lagrade som {"step":"stroke","condition":"stroke > 2000"}.
  // evalLogic returnerar objektet när det har fler än en nyckel, och ett
  // objekt är sanningsvärde-sant -- så varje sådan regel larmade ALLTID.
  // Testet dokumenterar beteendet så att formatet inte smyger tillbaka.
  const trasig = { step: "stroke", condition: "stroke > 2000" };
  assert(evalLogic(trasig, { stroke: 100 }), "objektet är sant oavsett kontext");

  const riktig = { ">": [{ var: "stroke" }, 2000] };
  assertEquals(evalLogic(riktig, { stroke: 100 }), false);
  assertEquals(evalLogic(riktig, { stroke: 2500 }), true);
});

Deno.test("validate larmar bara när villkoret är uppfyllt", () => {
  const rules: ConfigRule[] = [{
    id: "r1", schema_id: "S", severity: "error",
    if_json: { ">": [{ var: "stroke" }, 2000] },
    message_sv: "För långt slag.", message_en: "Stroke too long.", goto_step: null,
  }];
  assertEquals(validate(rules, { stroke: 100 }, "sv").length, 0);
  assertEquals(validate(rules, { stroke: 2500 }, "sv")[0].message, "För långt slag.");
});
