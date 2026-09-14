/**
 * HMR-reglerna som faktiskt körs, mot modellen som faktiskt bygger koden.
 *
 * Samma invariant som ELEKTRO, CCIV, EPCO och MFH: en kombination modellen
 * vägrar bygga MÅSTE ge minst ett fel, och en den bygger får inte ge något.
 *
 * HMR:s särdrag är att drivningen styr vad position fem betyder. Testet
 * prövar därför båda drivningarna mot BÅDA värdemängderna -- stigningar och
 * monteringslägen -- så att en stigning på en remdrift larmar och omvänt.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildHmrDbRules } from "../../../src/lib/catalog/hmr-db-rules.ts";
import {
  HMR_BELT_MOUNTS,
  HMR_CARRIAGES,
  HMR_DESIGNS,
  HMR_DRIVE_TYPES,
  HMR_GUIDE_MOUNTINGS,
  HMR_MOUNTING_KITS,
  HMR_PITCHES,
  HMR_SIZES,
  hmrBuildCode,
  hmrMaxStroke,
} from "../../../src/lib/catalog/hmr.ts";

const REGLER = buildHmrDbRules();
const NUMERISKA = new Set(["stroke_mm"]);

/** Bygger kontexten som configurator.$family.tsx gör: tal för numeriska fält. */
function ctx(v: Record<string, string | number>): Record<string, unknown> {
  const bas: Record<string, string | number> = {
    drive: "", size: "", design: "", pitch_or_mount: "", carriage: "", stroke_mm: 0,
    home_sensor: "", limit_sensor: "", sensor_position: "",
    mounting_kit: "", guide_mounting: "", ...v,
  };
  const ut: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(bas)) ut[k] = NUMERISKA.has(k) ? Number(raw || 0) : raw;
  return ut;
}
function kor(v: Record<string, string | number>, niva: string): string[] {
  const c = ctx(v);
  return REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, c) === true)
    .map((r) => r.message_sv);
}
const fel = (v: Record<string, string | number>) => kor(v, "error");

Deno.test("varje regel läser bara fält som finns", () => {
  const falt = new Set(Object.keys(ctx({})));
  const okanda = new Set<string>();
  const ga = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(ga);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.var === "string" && !falt.has(o.var)) okanda.add(o.var);
    Object.values(o).forEach(ga);
  };
  REGLER.forEach((r) => ga(r.if_json));
  assertEquals([...okanda], [], `regler läser fält som inte finns: ${[...okanda]}`);
});

Deno.test("modellen och reglerna är överens: drivning, storlek, position fem, vagn", () => {
  // Båda drivningarna × alla storlekar × ALLA värden för position fem (både
  // stigningar och monteringslägen) × alla vagnar. Slaget hålls giltigt.
  const pos5 = [...HMR_PITCHES.map((p) => p.code), ...HMR_BELT_MOUNTS.map((m) => m.code)];
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const d of HMR_DRIVE_TYPES) {
    for (const s of HMR_SIZES) {
      for (const p of pos5) {
        for (const c of HMR_CARRIAGES) {
          const v = { drive: d.code, size: s.code, design: "B", pitch_or_mount: p, carriage: c.code, stroke_mm: 500 };
          const kod = hmrBuildCode({ drive: d.code, size: s.code, design: "B", pitch_or_mount: p, carriage: c.code, stroke_mm: 500 });
          const f = fel(v);
          n++;
          if (!kod && f.length === 0) missade.push(JSON.stringify(v));
          if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
        }
      }
    }
  }
  assertEquals(missade.slice(0, 6), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 6), [], `${falsklarm.length} falsklarm`);
  assert(n > 300, `bara ${n} kombinationer prövade`);
});

Deno.test("modellen och reglerna är överens: monteringssats och växelmontage", () => {
  const kits = HMR_MOUNTING_KITS.map((k) => k.code);
  const guides = HMR_GUIDE_MOUNTINGS.map((g) => g.code);
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const s of HMR_SIZES) {
    const p = HMR_PITCHES.find((x) => x.sizes.includes(s.code))!.code;
    for (const k of kits) {
      for (const g of guides) {
        const v = { drive: "S", size: s.code, design: "B", pitch_or_mount: p, carriage: "0", stroke_mm: 500, mounting_kit: k, guide_mounting: g };
        const kod = hmrBuildCode({ drive: "S", size: s.code, design: "B", pitch_or_mount: p, carriage: "0", stroke_mm: 500, mounting_kit: k, guide_mounting: g });
        const f = fel(v);
        if (!kod && f.length === 0) missade.push(`${s.code}/${k}/${g}`);
        if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
      }
    }
  }
  assertEquals(missade.slice(0, 6), [], `${missade.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 6), [], `${falsklarm.length} falsklarm`);
});

Deno.test("slaglängdens tak följer drivning OCH storlek", () => {
  // Kulskruv 08 slutar vid 1 200; rem 15 går till 6 000. Databasen hade 3 000
  // för allt -- för högt för den ena, för lågt för den andra.
  const s08 = hmrMaxStroke("S", "08", "05")!;
  assertEquals(fel({ drive: "S", size: "08", design: "B", pitch_or_mount: "05", carriage: "0", stroke_mm: s08 }), []);
  assert(fel({ drive: "S", size: "08", design: "B", pitch_or_mount: "05", carriage: "0", stroke_mm: s08 + 1 })
    .some((m) => m.includes("1200")));

  const b15 = hmrMaxStroke("B", "15", "BD")!;
  assertEquals(fel({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: b15 }), []);
  assert(fel({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: b15 + 1 })
    .some((m) => m.includes("6000")));

  // Och 3 000 mm är fel åt båda hållen.
  assert(fel({ drive: "S", size: "08", design: "B", pitch_or_mount: "05", carriage: "0", stroke_mm: 3000 }).length > 0,
    "3 000 mm är för mycket för kulskruv 08");
  assertEquals(fel({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: 5000 }), [],
    "5 000 mm är fint för rem 15");
});

Deno.test("position fem larmar med rätt text åt båda hållen", () => {
  const skruvMedLage = fel({ drive: "S", size: "15", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: 500 });
  assertEquals(skruvMedLage.length, 1, skruvMedLage.join(" | "));
  assert(skruvMedLage[0].includes("Kulskruven har en skruvstigning"), skruvMedLage[0]);

  const remMedStigning = fel({ drive: "B", size: "15", design: "B", pitch_or_mount: "05", carriage: "0", stroke_mm: 500 });
  assertEquals(remMedStigning.length, 1, remMedStigning.join(" | "));
  assert(remMedStigning[0].includes("Remdriften har inget stigningsval"), remMedStigning[0]);

  // Fel stigning för storleken: en rad, med de rätta stigningarna i klartext.
  const felStigning = fel({ drive: "S", size: "08", design: "B", pitch_or_mount: "32", carriage: "0", stroke_mm: 500 });
  assertEquals(felStigning.length, 1, felStigning.join(" | "));
  assert(felStigning[0].includes("5 och 12 mm"), felStigning[0]);
});

Deno.test("delad vagn på kulskruv larmar", () => {
  const f = fel({ drive: "S", size: "15", design: "B", pitch_or_mount: "05", carriage: "2", stroke_mm: 500 });
  assert(f.some((m) => m.includes("Delad vagn")), f.join(" | "));
  assertEquals(fel({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", carriage: "2", stroke_mm: 500 }), []);
});

Deno.test("råden är info och varningar, inte fel", () => {
  // Den grova stigningen ger ett råd.
  const info = kor({ drive: "S", size: "15", design: "B", pitch_or_mount: "20", carriage: "0", stroke_mm: 500 }, "info");
  assertEquals(info.length, 1, info.join(" | "));
  assert(info[0].includes("1 m/s"), info[0]);
  assertEquals(kor({ drive: "S", size: "15", design: "B", pitch_or_mount: "05", carriage: "0", stroke_mm: 500 }, "info"), []);

  // Rem 15 i 000°/180° tappar kraft: varning.
  const varn = kor({ drive: "B", size: "15", design: "B", pitch_or_mount: "AP", carriage: "0", stroke_mm: 500 }, "warn");
  assert(varn.some((m) => m.includes("630 N")), varn.join(" | "));
  assertEquals(kor({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: 500 }, "warn")
    .filter((m) => m.includes("630 N")), []);

  // Rem 18 och 24 saknar tekniska data: varning, inte fel.
  const utanData = kor({ drive: "B", size: "24", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: 500 }, "warn");
  assert(utanData.some((m) => m.includes("Kontrollera med Parker")), utanData.join(" | "));
  assertEquals(fel({ drive: "B", size: "24", design: "B", pitch_or_mount: "BD", carriage: "0", stroke_mm: 500 }), []);
});

Deno.test("en tom konfiguration larmar inte", () => {
  assertEquals(fel({}), []);
  assertEquals(fel({ drive: "S" }), []);
  assertEquals(fel({ drive: "S", size: "15" }), []);
  assertEquals(kor({}, "warn"), []);
  assertEquals(kor({}, "info"), []);
});

Deno.test("varje regel har både svensk och engelsk text", () => {
  assertEquals(REGLER.filter((r) => !r.message_sv?.trim() || !r.message_en?.trim()).length, 0);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  assertEquals(HMR_DESIGNS.length, 4, "och utförandet har inga regler -- alla fyra finns för allt");
});

Deno.test("ingen regel förekommer två gånger", () => {
  // Skruvtabellen har två rader per storlek. En loop över raderna gav samma
  // slagregel två gånger, och den hade visats två gånger för kunden.
  const nycklar = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  const dubbletter = nycklar.filter((n, i) => nycklar.indexOf(n) !== i);
  assertEquals(dubbletter, [], `dubbletter: ${dubbletter.map((d) => d.split("|")[1]).join(" ; ")}`);
});
