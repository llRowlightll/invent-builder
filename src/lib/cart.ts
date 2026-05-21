// Cart utility — browser-only (localStorage + custom event)
// Safe to import anywhere: all access is guarded by typeof window check.

export const SHOPPING_LIST_KEY = "mv_shopping_list";
export const SHOPPING_LIST_COUNT_KEY = "mv_shopping_list_count";

export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  qty: number;
}

export function addToShoppingList(product: { id: string; sku: string; name: string }) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SHOPPING_LIST_KEY);
    const items: CartItem[] = raw ? JSON.parse(raw) : [];
    const existing = items.find((i) => i.product_id === product.id);
    const updated = existing
      ? items.map((i) =>
          i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      : [
          ...items,
          { product_id: product.id, sku: product.sku, name: product.name, qty: 1 },
        ];
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
