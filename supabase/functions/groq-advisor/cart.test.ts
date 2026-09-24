/**
 * Inköpslistans rader.
 *
 * Testet finns för att konfiguratorns "Lägg till i BOM" inte skrev någonting
 * alls -- knappen satte en boolean, bytte text till "✓ Tillagd i BOM" och
 * ljög. När den nu skriver på riktigt är det sammanslagningen som avgör om
 * kunden får rätt vara: två olika konfigurationer av samma familj delar
 * product_id men är INTE samma artikel.
 */
import { assertEquals } from "jsr:@std/assert@1";
import { cartKey, mergeCartItem, type CartItem } from "../../../src/lib/cart.ts";

const katalograd: CartItem = { product_id: "p1", sku: "FESTO-DSNU", name: "DSNU", qty: 1 };

Deno.test("samma vara igen räknar upp antalet i stället för att dubblera raden", () => {
  const en = mergeCartItem([], katalograd);
  const tva = mergeCartItem(en, katalograd);
  assertEquals(tva.length, 1);
  assertEquals(tva[0].qty, 2);
});

Deno.test("två konfigurationer av samma familj är två rader", () => {
  const a: CartItem = { product_id: "p1", sku: "DSNU-32-100-PPS-A", name: "DSNU", qty: 1, order_code: "DSNU-32-100-PPS-A" };
  const b: CartItem = { product_id: "p1", sku: "DSNU-25-50-PPS-A",  name: "DSNU", qty: 1, order_code: "DSNU-25-50-PPS-A" };
  const lista = mergeCartItem(mergeCartItem([], a), b);
  assertEquals(lista.length, 2, "samma product_id men olika orderkod får inte slås ihop");
  assertEquals(lista.map((i) => i.qty), [1, 1]);
});

Deno.test("konfigurerad rad slås inte ihop med seriens katalograd", () => {
  const konfad: CartItem = { product_id: "p1", sku: "DSNU-32-100-PPS-A", name: "DSNU", qty: 1, order_code: "DSNU-32-100-PPS-A" };
  const lista = mergeCartItem(mergeCartItem([], katalograd), konfad);
  assertEquals(lista.length, 2, "serien och en konfigurerad variant är olika varor");
});

Deno.test("gamla rader utan order_code behåller sin nyckel", () => {
  // Rader som redan ligger i någons localStorage saknar fältet helt.
  const gammal = { product_id: "p1", sku: "FESTO-DSNU", name: "DSNU", qty: 3 } as CartItem;
  assertEquals(cartKey(gammal), cartKey(katalograd));
  const lista = mergeCartItem([gammal], katalograd);
  assertEquals(lista.length, 1);
  assertEquals(lista[0].qty, 4);
});

Deno.test("familj utan katalogpost får en rad som bär bara koden", () => {
  const utan: CartItem = { product_id: null, sku: "CY1L-25-500", name: "CY1L", qty: 1, order_code: "CY1L-25-500" };
  const annan: CartItem = { product_id: null, sku: "CY1L-32-500", name: "CY1L", qty: 1, order_code: "CY1L-32-500" };
  const lista = mergeCartItem(mergeCartItem([], utan), annan);
  assertEquals(lista.length, 2, "två koder utan produkt-id får inte kollidera på tom nyckel");
  assertEquals(mergeCartItem(lista, utan).length, 2);
  assertEquals(mergeCartItem(lista, utan)[0].qty, 2);
});

Deno.test("orderkoden är skiftlägesokänslig och trimmas", () => {
  const a: CartItem = { product_id: "p1", sku: "X", name: "X", qty: 1, order_code: "dsnu-32 " };
  const b: CartItem = { product_id: "p1", sku: "X", name: "X", qty: 1, order_code: "DSNU-32" };
  assertEquals(mergeCartItem(mergeCartItem([], a), b).length, 1);
});

Deno.test("antalet är minst ett och alltid ett heltal", () => {
  const noll = mergeCartItem([], { ...katalograd, qty: 0 });
  assertEquals(noll[0].qty, 1);
  const negativ = mergeCartItem([], { ...katalograd, qty: -5 });
  assertEquals(negativ[0].qty, 1);
});
