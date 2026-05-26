/**
 * Client-side helpers for the document-ai Supabase edge function.
 * Converts files to base64 and calls the edge function.
 */

const EDGE = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/document-ai";

export type DocMode = "po" | "quote" | "identify";

export interface PoExtraction {
  po_number: string | null;
  company_name: string | null;
  org_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address: {
    street: string | null;
    postal: string | null;
    city: string | null;
    country: string | null;
  } | null;
  delivery_date: string | null;
  payment_terms: string | null;
  items: Array<{
    description: string;
    qty: number;
    unit: string | null;
    unit_price: number | null;
    total: number | null;
  }>;
  notes: string | null;
  currency: string | null;
}

export interface QuoteExtraction {
  supplier_name: string | null;
  quote_reference: string | null;
  valid_until: string | null;
  currency: string | null;
  delivery_weeks: string | null;
  payment_terms: string | null;
  items: Array<{
    article_number: string | null;
    description: string;
    qty: number;
    unit_price_ex_vat: number | null;
    total_ex_vat: number | null;
    delivery_time: string | null;
    note: string | null;
  }>;
  total_ex_vat: number | null;
  notes: string | null;
}

export interface ComponentIdentification {
  identified: boolean;
  component_type: string | null;
  manufacturer: string | null;
  model_number: string | null;
  description: string;
  specifications: {
    bore_mm: number | null;
    stroke_mm: number | null;
    voltage: string | null;
    ip_rating: string | null;
    other: Record<string, unknown>;
  };
  condition: string;
  damage_description: string | null;
  replacement_search: string;
  category_slug: string | null;
  urgency: "critical" | "normal" | "planned";
  recommendation: string;
}

/** Convert a File to base64 + mime_type */
export function fileToBase64(file: File): Promise<{ data: string; mime_type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, data] = dataUrl.split(",");
      const mime_type = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      resolve({ data, mime_type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Call the document-ai edge function */
export async function analyzeDocument(file: File, mode: DocMode): Promise<unknown> {
  const { data, mime_type } = await fileToBase64(file);
  const res = await fetch(EDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, mime_type, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
