/**
 * EX500-modellen och dess regler mot katalogen.
 *
 * Facit: nycklarnas EX500-GEN2/GPN2 (sida 1449), EX500-S103 (sida 1451),
 * EX500-DXPA/DXPB (sida 1452), EX500-AC030-SSPS och EX500-ACY01-S
 * (sida 1457); systemgränserna (sida 1448–1449).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildEx500DbRules } from "../../../src/lib/catalog/ex500-db-rules.ts";
import {
  EX500_CABLE_CONNECTORS,
  EX500_CONNECTORS,
  EX500_LENGTHS,
  EX500_LIMITS,
  EX500_ORDER_CODE_TEMPLATE,
  EX500_PROTOCOLS,
  EX500_SOURCE,
  EX500_UNITS,
  type EX500Config,
  ex500BuildCode,
  ex500ParseCode,
} from "../../../src/lib/catalog/ex500.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(EX500_SOURCE.file, "smc-kat-ex500.pdf");
  assertEquals(EX500_UNITS.map((u) => u.code), ["G", "S103", "DXP", "AC", "ACY01-S"]);
  assertEquals(EX500_PROTOCOLS.map((p) => p.code), ["EN2", "PN2"], "typ 2 har bara EtherNet/IP och PROFINET (sida 1449)");
  assertEquals(EX500_LENGTHS.map((l) => l.code), ["003", "005", "010", "030", "050", "100"]);
  assertEquals([EX500_LIMITS.io_points, EX500_LIMITS.branch_ports, EX500_LIMITS.per_branch_io, EX500_LIMITS.branch_cable_max_m], [128, 4, 32, 20]);
});

Deno.test("katalogens artikelnummer byggs tecken för tecken", () => {
  const fall: Array<[EX500Config, string]> = [
    [{ unit: "G", protocol: "EN2" }, "EX500-GEN2"],
    [{ unit: "G", protocol: "PN2" }, "EX500-GPN2"],
    [{ unit: "S103" }, "EX500-S103"],
    [{ unit: "DXP", connector: "A" }, "EX500-DXPA"],
    [{ unit: "DXP", connector: "B" }, "EX500-DXPB"],
    [{ unit: "AC", length: "030", cable_conn: "SSPS" }, "EX500-AC030-SSPS"],
    [{ unit: "AC", length: "100", cable_conn: "SAPA" }, "EX500-AC100-SAPA"],
    [{ unit: "ACY01-S" }, "EX500-ACY01-S"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(ex500BuildCode(c), kod);
    assertEquals(ex500BuildCode(ex500ParseCode(kod)!.config), kod);
  }
  assertEquals(ex500ParseCode("EX500-Q011"), null, "den påhittade produktraden");
  assertEquals(ex500ParseCode("EX500-GDN1"), null, "DeviceNet hör till det gamla systemet, inte typ 2");
  assertEquals(ex500ParseCode("EX500-4-ethernetip-24DC"), null, "den gamla mallen");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = ex500BuildCode;
  assertEquals(b({ unit: "G" }), null, "GW kräver protokoll");
  assertEquals(b({ unit: "S103", protocol: "EN2" }), null, "protokoll bara på GW");
  assertEquals(b({ unit: "DXP" }), null, "DXP kräver kontakt");
  assertEquals(b({ unit: "G", protocol: "EN2", connector: "A" }), null, "kontakt bara på DXP");
  assertEquals(b({ unit: "AC", length: "030" }), null, "kabel kräver båda");
  assertEquals(b({ unit: "AC", cable_conn: "SSPS" }), null);
  assertEquals(b({ unit: "AC", length: "020", cable_conn: "SSPS" }), null, "20 finns inte");
  assertEquals(b({ unit: "ACY01-S", length: "030", cable_conn: "SSPS" }), null);
  assertEquals(b({ unit: "X" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildEx500DbRules();
function ctx(c: EX500Config): Record<string, unknown> {
  return { unit: c.unit, protocol: c.protocol ?? "", connector: c.connector ?? "", length: c.length ?? "", cable_conn: c.cable_conn ?? "" };
}
const kor = (c: EX500Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: EX500Config) => kor(c, "error");

Deno.test("alla kombinationer: reglerna säger nej exakt när modellen gör det", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const u of EX500_UNITS) for (const protocol of ["", ...EX500_PROTOCOLS.map((p) => p.code)]) for (const connector of ["", ...EX500_CONNECTORS.map((p) => p.code)])
    for (const length of ["", ...EX500_LENGTHS.map((p) => p.code)]) for (const cable_conn of ["", ...EX500_CABLE_CONNECTORS.map((p) => p.code)]) {
      const c: EX500Config = { unit: u.code, protocol: protocol || undefined, connector: connector || undefined, length: length || undefined, cable_conn: cable_conn || undefined };
      const kod = ex500BuildCode(c);
      const f = fel(c);
      n++;
      if (!kod && f.length === 0) missade.push(JSON.stringify(c));
      if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
    }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(n >= 900);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { unit: "G", protocol: "EN2" },
    { unit: "S103" },
    { unit: "DXP", connector: "B" },
    { unit: "AC", length: "030", cable_conn: "SSPS" },
    { unit: "ACY01-S" },
  ] as EX500Config[]) {
    assertEquals(fillOrderCodeTemplate(EX500_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string>, new Set(["unit"])), ex500BuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ unit: "G" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("EN2 eller PN2"), f[0]);
  assert(kor({ unit: "G", protocol: "EN2" }, "info").some((m) => m.includes("4 grenportar") && m.includes("20 m")));
  assert(kor({ unit: "S103" }, "info").some((m) => m.includes("16 eller 32 utgångar")));
  assert(kor({ unit: "AC", length: "030", cable_conn: "SSPS" }, "info").some((m) => m.includes("bara SY och SV")));
  const tom = { unit: "" } as EX500Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});
