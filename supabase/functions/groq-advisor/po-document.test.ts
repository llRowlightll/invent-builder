/**
 * Inköpsorderns regler.
 *
 * Provet finns för att ett mejl till en leverantör inte går att ta tillbaka.
 * Reglerna för NÄR en inköpsorder får skickas provas därför utan databas och
 * utan nätverk -- de ska hålla även den dag någon bygger om resten.
 *
 * FILEN LIGGER I groq-advisor/ trots att den provar supplier-po: CI kör
 * `deno test supabase/functions/groq-advisor/`, och ett prov som inte körs är
 * inget prov. Flyttas det hit när testkommandot breddas.
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  amnesrad, byggPoDokument, faarSkickas,
  type PoHuvud, type PoLeverantor, type PoRad,
} from "../supplier-po/po-document.ts";

const foretag = {
  name: "Maskinval AB", org: "556000-0000", address: "Industrivägen 1",
  postal: "123 45 Stockholm", email: "info@maskinval.se", phone: "+46 8 000 00 00",
  web: "maskinval.se", vat: "SE556000000001",
};

const huvud: PoHuvud = {
  po_number: "MPO-2026-00431", created_at: "2026-09-24T10:00:00Z",
  expected_delivery: "2026-10-12", currency: "SEK", status: "draft",
  sent_at: null, needs_review: false, review_reason: null,
};

const festo: PoLeverantor = {
  name: "Festo", order_email: "order@example.invalid", customer_number: "12345",
  currency: "SEK", payment_terms: "30 dagar netto", incoterms: "DAP",
  agreement_status: "signed", contact_name: null, contact_email: null, min_order_value: null,
};

const rader: PoRad[] = [
  { line_no: 1, sku: "DSNU-32-100-PPS", supplier_sku: "19236", name: "DSNU", qty: 2, unit_purchase_price: 500, line_total_ex_vat: 1000 },
  { line_no: 2, sku: "FESTO-ADN", supplier_sku: null, name: "ADN", qty: 1, unit_purchase_price: 250, line_total_ex_vat: 250 },
];

function dok(o: Partial<{ huvud: PoHuvud; leverantor: PoLeverantor | null; rader: PoRad[] }> = {}) {
  return byggPoDokument({
    huvud: o.huvud ?? huvud,
    leverantor: o.leverantor === undefined ? festo : o.leverantor,
    rader: o.rader ?? rader,
    kundorder: { order_number: "MV-2026-00124" },
    foretag,
  });
}

Deno.test("en komplett inköpsorder får skickas", () => {
  const d = dok();
  assertEquals(d.hinder, []);
  assertEquals(d.varningar, []);
  assertEquals(d.summa, 1250);
  assertEquals(faarSkickas(d, { sent_at: null }).ok, true);
});

Deno.test("utan beställningsadress går den inte att skicka, och kan inte bekräftas förbi", () => {
  const d = dok({ leverantor: { ...festo, order_email: "  " } });
  const beslut = faarSkickas(d, { sent_at: null }, { bekraftaVarningar: true, skickaOm: true });
  assertEquals(beslut.ok, false);
  assertEquals(beslut.kanBekraftas, false);
  assertEquals(beslut.skal?.includes("beställningsadress"), true);
});

Deno.test("utan leverantör är det ett hinder, inte en varning", () => {
  const d = dok({ leverantor: null });
  assertEquals(d.hinder.length, 1);
  assertEquals(faarSkickas(d, { sent_at: null }, { bekraftaVarningar: true }).ok, false);
});

Deno.test("en inköpsorder utan rader skickas inte", () => {
  const d = dok({ rader: [] });
  assertEquals(d.hinder.some((h) => h.includes("inga rader")), true);
});

Deno.test("redan skickad går inte igen utan uttryckligt omtag", () => {
  const d = dok();
  const en_gang_till = faarSkickas(d, { sent_at: "2026-09-24T11:30:00Z" });
  assertEquals(en_gang_till.ok, false);
  assertEquals(en_gang_till.skal?.includes("skickades redan"), true);
  assertEquals(faarSkickas(d, { sent_at: "2026-09-24T11:30:00Z" }, { skickaOm: true }).ok, true);
});

Deno.test("varningar stoppar tills de bekräftas", () => {
  const d = dok({ leverantor: { ...festo, agreement_status: "unknown", customer_number: null } });
  assertEquals(d.varningar.length, 2);
  const stopp = faarSkickas(d, { sent_at: null });
  assertEquals(stopp.ok, false);
  assertEquals(stopp.kanBekraftas, true, "en människa ska kunna ta beslutet");
  assertEquals(faarSkickas(d, { sent_at: null }, { bekraftaVarningar: true }).ok, true);
});

Deno.test("saknat inköpspris räknas och summan blir bara det kända", () => {
  const halva = [rader[0], { ...rader[1], unit_purchase_price: null, line_total_ex_vat: null }];
  const d = dok({ rader: halva });
  assertEquals(d.raderUtanPris, 1);
  assertEquals(d.summa, 1000);
  assertEquals(d.varningar.some((v) => v.includes("1 av 2")), true);
});

Deno.test("utan pris på någon rad säger varningen det rakt ut", () => {
  const inget = rader.map((r) => ({ ...r, unit_purchase_price: null, line_total_ex_vat: null }));
  const d = dok({ rader: inget });
  assertEquals(d.summa, null);
  assertEquals(d.varningar.some((v) => v.includes("inget pris alls")), true);
});

Deno.test("under minsta ordervärde varnar", () => {
  const d = dok({ leverantor: { ...festo, min_order_value: 5000 } });
  assertEquals(d.varningar.some((v) => v.includes("minsta ordervärde")), true);
});

Deno.test("granskningsflaggan följer med som varning", () => {
  const d = dok({ huvud: { ...huvud, needs_review: true, review_reason: "okänd leverantör" } });
  assertEquals(d.varningar[0].includes("okänd leverantör"), true);
});

Deno.test("raderna kommer i radordning oavsett hur de lästes", () => {
  const d = dok({ rader: [rader[1], rader[0]] });
  assertEquals(d.rader.map((r) => r.line_no), [1, 2]);
});

Deno.test("ämnesraden bär numret leverantören ska svara med", () => {
  assertEquals(amnesrad(dok()), "Inköpsorder MPO-2026-00431 - Maskinval AB");
});
