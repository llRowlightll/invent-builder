/**
 * Mejlen i orderns resa (supabase/functions/orderhandelse/mejl.ts).
 * Ligger här eftersom CI kör `deno test supabase/functions/groq-advisor/`.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { borSkickas, byggMejl, idempotensnyckel, type Resa } from "../orderhandelse/mejl.ts";

const ORDER = "11111111-2222-3333-4444-555555555555";
const SHIP = "99999999-8888-7777-6666-555555555555";

function resa(o: Partial<Resa> = {}): Resa {
  return {
    order_number: "MV-2026-00124", status: "new", avbruten: false, kund: "Anna", po_number: "PO-1",
    eta: "2026-11-20", eta_kalla: "uppskattning",
    steg: [
      { kod: "mottagen", klar: true, tid: "2026-11-12T10:00:00Z" },
      { kod: "bestalld", klar: false, tid: null },
      { kod: "bekraftad", klar: false, tid: null },
      { kod: "skickad", klar: false, delvis: false, tid: null },
      { kod: "levererad", klar: false, tid: null },
    ],
    rader: [{ line_no: 1, sku: "DSBC-50-400", name: "Cylinder <b>", qty: 2, status: "pending", skickat: 0 }],
    forsandelser: [],
    ...o,
  };
}

Deno.test("mottagen: tack, uppskattad leverans med ca, länk till spårningen, HTML tvättas", () => {
  const m = byggMejl(resa(), "mottagen", ORDER, null);
  assertEquals(m.amne, "Vi har tagit emot din beställning MV-2026-00124");
  assert(m.html.includes("ca "));
  assert(m.html.includes(`/sv/order/${ORDER}`));
  assert(m.html.includes("Cylinder &lt;b&gt;"));
});

Deno.test("bekräftad mejlas bara när alla leverantörer bekräftat", () => {
  assertEquals(borSkickas(resa(), "bekraftad", null), false);
  const r = resa({ eta_kalla: "leverantor", steg: resa().steg.map((s) => s.kod === "bekraftad" ? { ...s, klar: true } : s) });
  assertEquals(borSkickas(r, "bekraftad", null), true);
  const m = byggMejl(r, "bekraftad", ORDER, null);
  assert(m.amne.startsWith("Din order MV-2026-00124 är bekräftad"));
  assert(!m.html.includes("ca "), "leverantörens datum är inget ca-datum");
});

Deno.test("skickad kräver en riktig försändelse och visar spårningen", () => {
  assertEquals(borSkickas(resa(), "skickad", SHIP), false);
  const f = { id: SHIP, nr: 1, fraktbolag: "postnord", sparningsnummer: "AB123456789SE",
    url: "https://tracking.postnord.com/se/?id=AB123456789SE", skickad: "2026-11-14T08:00:00Z", beraknad: "2026-11-17",
    levererad: null, status: "in_transit", rader: [{ sku: "DSBC-50-400", name: "Cylinder", qty: 1 }] };
  const r = resa({ forsandelser: [f], steg: resa().steg.map((s) => s.kod === "skickad" ? { ...s, delvis: true, tid: f.skickad } : s) });
  assertEquals(borSkickas(r, "skickad", SHIP), true);
  const m = byggMejl(r, "skickad", ORDER, SHIP);
  assertEquals(m.amne, "Din order MV-2026-00124 är på väg (försändelse 1)");
  assert(m.html.includes("PostNord"));
  assert(m.html.includes("AB123456789SE"));
  assert(m.html.includes("Spåra paketet"));
});

Deno.test("en spårningslänk som inte är https visas inte", () => {
  const f = { id: SHIP, nr: 1, fraktbolag: "annat", sparningsnummer: "X1234", url: "javascript:alert(1)", skickad: null,
    beraknad: null, levererad: null, status: "in_transit", rader: [] };
  const m = byggMejl(resa({ forsandelser: [f] }), "skickad", ORDER, SHIP);
  assert(!m.html.includes("javascript:"));
});

Deno.test("avbruten order mejlas inte; nycklarna är per händelse och per försändelse", () => {
  assertEquals(borSkickas(resa({ avbruten: true }), "mottagen", null), false);
  assertEquals(idempotensnyckel(ORDER, "mottagen", null), `resa:${ORDER}:mottagen`);
  assertEquals(idempotensnyckel(ORDER, "skickad", SHIP), `resa:${ORDER}:skickad:${SHIP}`);
});
