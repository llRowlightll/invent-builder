/**
 * Company settings fetched from site_content table.
 * Keys: company.name, company.org, company.address, company.postal,
 *       company.email, company.phone, company.web, company.bankgiro, company.vat
 *
 * All stored with locale = 'all'.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CompanySettings {
  name: string;
  org: string;
  address: string;
  postal: string;
  email: string;
  phone: string;
  web: string;
  bankgiro: string;
  vat: string;
}

const DEFAULTS: CompanySettings = {
  name: "Maskinval AB",
  org: "556000-0000",
  address: "Industrivägen 1",
  postal: "123 45 Stockholm",
  email: "info@maskinval.se",
  phone: "+46 8 000 00 00",
  web: "maskinval.se",
  bankgiro: "",
  vat: "",
};

const KEY_MAP: Record<keyof CompanySettings, string> = {
  name:      "company.name",
  org:       "company.org",
  address:   "company.address",
  postal:    "company.postal",
  email:     "company.email",
  phone:     "company.phone",
  web:       "company.web",
  bankgiro:  "company.bankgiro",
  vat:       "company.vat",
};

/** Fetch all company settings rows from site_content. Falls back to defaults. */
export async function fetchCompanySettings(): Promise<CompanySettings> {
  const keys = Object.values(KEY_MAP);
  const { data, error } = await supabase
    .from("site_content")
    .select("key, value")
    .in("key", keys);

  if (error || !data?.length) return { ...DEFAULTS };

  const result = { ...DEFAULTS };
  for (const row of data) {
    const field = Object.entries(KEY_MAP).find(([, k]) => k === row.key)?.[0] as keyof CompanySettings | undefined;
    if (field) result[field] = row.value ?? DEFAULTS[field];
  }
  return result;
}

/** Upsert a single company setting. */
export async function saveCompanySetting(field: keyof CompanySettings, value: string) {
  const key = KEY_MAP[field];
  return supabase
    .from("site_content")
    .upsert({ key, locale: "all", value }, { onConflict: "key,locale" });
}
