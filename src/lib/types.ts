export type Mode = "best" | "cheapest";
export type Feedback = "incremental" | "absolute";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  family: string | null;
  brand: { slug: string; name: string };
  category: { slug: string; name: string };
  lead_time_days: number | null;
  availability: string | null;
  purchase_price: number | null;
  margin: number | null;
  weight_kg: number | null;
  ip_rating: string | null;
  fieldbus: string | null;
  voltage: string | null;
  image_url: string | null;
  specs: Record<string, { value: string; unit: string | null }>;
}

export interface BomItem {
  role: string;
  product: ProductRow;
  qty: number;
  why: string;
}

export interface SelectionInput {
  stroke_mm: number;
  force_n: number;
  voltage: "230VAC" | "400VAC";
  fieldbus: "PROFINET" | "EthernetIP" | "none";
  feedback: Feedback;
  ip: "IP54" | "IP65" | "IP67";
  mode: Mode;
}

export interface SelectionResult {
  items: BomItem[];
  orderCode: string;
  validation: { level: "info" | "warn" | "error"; message: string }[];
  notes: string[];
}
