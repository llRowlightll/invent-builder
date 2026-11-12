/// <reference lib="deno.ns" />
// Körs med: deno test tests/orderresa.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { aktuelltSteg, arbetsdagarTill, etaText, radstatus, type Resa } from "../src/lib/orderresa.ts";

function resa(o: Partial<Resa> = {}): Resa {
  return {
    order_number: "MV-2026-00124", skapad: "2026-11-12T10:00:00Z", status: "new", avbruten: false, kund: "Anna",
    ort: "Göteborg", po_number: null, eta: "2026-11-20", eta_kalla: "uppskattning",
    steg: [
      { kod: "mottagen", klar: true, tid: "2026-11-12T10:00:00Z" },
      { kod: "bestalld", klar: false, tid: null },
      { kod: "bekraftad", klar: false, tid: null },
      { kod: "skickad", klar: false, delvis: false, tid: null },
      { kod: "levererad", klar: false, tid: null },
    ],
    rader: [], forsandelser: [], ...o,
  };
}
const med = (r: Resa, kod: string, f: Record<string, unknown>) => ({ ...r, steg: r.steg.map((s) => s.kod === kod ? { ...s, ...f } : s) });

Deno.test("rubriken följer det senaste steget", () => {
  assertEquals(aktuelltSteg(resa()), "mottagen");
  assertEquals(aktuelltSteg(med(resa(), "bestalld", { klar: true })), "bestalld");
  assertEquals(aktuelltSteg(med(med(resa(), "bestalld", { klar: true }), "bekraftad", { klar: true })), "bekraftad");
  assertEquals(aktuelltSteg(med(resa(), "skickad", { delvis: true })), "delvis");
  assertEquals(aktuelltSteg(med(resa(), "skickad", { klar: true })), "skickad");
  assertEquals(aktuelltSteg(med(resa(), "levererad", { klar: true })), "levererad");
  assertEquals(aktuelltSteg(resa({ avbruten: true })), "avbruten");
});

Deno.test("arbetsdagar hoppar över helgen", () => {
  // Torsdag 12 nov -> måndag 16 nov = 2 arbetsdagar (fre, mån).
  assertEquals(arbetsdagarTill("2026-11-16", new Date(2026, 10, 12)), 2);
  assertEquals(arbetsdagarTill("2026-11-12", new Date(2026, 10, 12)), 0);
});

Deno.test("uppskattning skrivs med ca, leverantörens datum utan", () => {
  const idag = new Date(2026, 10, 12);
  const u = etaText({ eta: "2026-11-16", eta_kalla: "uppskattning" }, "sv", idag)!;
  assertEquals(u.datum.startsWith("ca "), true);
  assertEquals(u.om, "Om ca 2 arbetsdagar");
  const l = etaText({ eta: "2026-11-13", eta_kalla: "leverantor" }, "sv", idag)!;
  assertEquals(l.datum.startsWith("ca"), false);
  assertEquals(l.om, "Om 1 arbetsdag");
  assertEquals(etaText({ eta: null, eta_kalla: "uppskattning" }, "sv"), null);
});

Deno.test("artikelns chipp: bekräftad med datum, delvis på väg", () => {
  const r = { line_no: 1, sku: "X", name: "X", qty: 3, status: "acknowledged", skickat: 0, bekraftad_leverans: "2026-11-20" };
  assertEquals(radstatus(r, "sv").text.startsWith("Bekräftad ·"), true);
  assertEquals(radstatus({ ...r, skickat: 2 }, "sv").text, "2 av 3 på väg");
  assertEquals(radstatus({ ...r, status: "pending" }, "sv").text, "Mottagen");
});
