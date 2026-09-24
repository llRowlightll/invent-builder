// Cart utility — browser-only (localStorage + custom event)
// Safe to import anywhere: all access is guarded by typeof window check.
//
// Två sorters rader ligger i samma lista:
//
//   KATALOGRAD      product_id pekar på en produkt, order_code saknas.
//                   Det är "Lägg i inköpslistan" på produktsidan.
//
//   KONFIGURERAD    order_code är den kod kunden faktiskt beställer
//   RAD             ("DSNU-32-100-PPS-A"), och product_id pekar på seriens
//                   katalogpost när en sådan finns. 15 av 169 familjer har
//                   ingen -- de raderna har product_id null och bär bara koden.
//
// product_id DUGER DÄRFÖR INTE som radidentitet längre: två konfigurationer av
// DSNU har samma produkt men är olika varor, och en konfigurerad rad utan
// katalogpost har inget id alls. cartKey() är identiteten i stället.

export const SHOPPING_LIST_KEY = "mv_shopping_list";
export const SHOPPING_LIST_COUNT_KEY = "mv_shopping_list_count";

export interface CartItem {
  /** Katalogprodukten. null för en konfigurerad artikel utan katalogpost. */
  product_id: string | null;
  sku: string;
  name: string;
  qty: number;
  /** Konfiguratorns färdiga orderkod. Saknas på en vanlig katalograd. */
  order_code?: string | null;
}

/**
 * Radens identitet: produkt + orderkod.
 *
 * Gamla rader i localStorage saknar order_code och får nyckeln "<id>|" --
 * samma nyckel som en ny katalograd för samma produkt. Listor som redan ligger
 * i någons webbläsare fortsätter alltså fungera och slås ihop som förut.
 */
export function cartKey(item: Pick<CartItem, "product_id" | "order_code">): string {
  return `${item.product_id ?? ""}|${(item.order_code ?? "").trim().toUpperCase()}`;
}

/**
 * Lägger till en vara, eller räknar upp antalet om samma vara redan finns.
 *
 * Ren funktion så att sammanslagningen går att prova utan webbläsare -- det
 * var just den som var fel: konfiguratorns knapp skrev ingenting alls.
 */
export function mergeCartItem(items: CartItem[], add: CartItem): CartItem[] {
  const key = cartKey(add);
  const qty = Math.max(1, Math.round(add.qty || 1));
  const existing = items.find((i) => cartKey(i) === key);
  if (existing) {
    return items.map((i) => (cartKey(i) === key ? { ...i, qty: i.qty + qty } : i));
  }
  return [...items, { ...add, qty }];
}

export function addToShoppingList(
  product: { id: string | null; sku: string; name: string; order_code?: string | null },
  qty = 1,
) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SHOPPING_LIST_KEY);
    const items: CartItem[] = raw ? JSON.parse(raw) : [];
    const updated = mergeCartItem(items, {
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      qty,
      order_code: product.order_code ?? null,
    });
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(updated));
    localStorage.setItem(
      SHOPPING_LIST_COUNT_KEY,
      String(updated.reduce((s, i) => s + i.qty, 0))
    );
    window.dispatchEvent(new Event("shopping-list-updated"));
  } catch {}
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHOPPING_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items));
    localStorage.setItem(
      SHOPPING_LIST_COUNT_KEY,
      String(items.reduce((s, i) => s + i.qty, 0))
    );
    window.dispatchEvent(new Event("shopping-list-updated"));
  } catch {}
}

export function getCartCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(SHOPPING_LIST_COUNT_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}
