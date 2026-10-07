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

/**
 * Platshållare som låg i både koden och databasen fram till 2026-10-03:
 * org.nr 556000-0000, momsnr SE556000000001, telefon +46 8 000 00 00 och
 * "Industrivägen 1, 123 45 Stockholm". De skrevs ut på kundens offert och
 * orderbekräftelse. Ett påhittat organisationsnummer på en offert är värre än
 * inget alls, så de behandlas som tomma tills de riktiga är ifyllda.
 */
const PLATSHALLARE: Partial<Record<keyof CompanySettings, string>> = {
  org: "556000-0000",
  vat: "SE556000000001",
  phone: "+46 8 000 00 00",
  address: "Industrivägen 1",
  postal: "123 45 Stockholm",
};

const DEFAULTS: CompanySettings = {
  name: "Maskinval",
  org: "",
  address: "",
  postal: "",
  email: "info@maskinval.se",
  phone: "",
  web: "maskinval.se",
  bankgiro: "",
  vat: "",
};

/**
 * Namnet som får stå på sidor och dokument. "AB" förutsätter ett registrerat
 * aktiebolag, så utan organisationsnummer skrivs bara varumärket ut -- kunden
 * ska aldrig se ett bolag som inte finns (databasen har "Maskinval AB" sedan
 * starten, före registreringen).
 */
export function visningsnamn(c: Pick<CompanySettings, "name" | "org"> | null | undefined): string {
  const namn = (c?.name ?? "").trim() || "Maskinval";
  if (c?.org?.trim()) return namn;
  return namn.replace(/\s+AB$/i, "").trim() || "Maskinval";
}

/** Fält som en offert behöver och som saknas -- för varningen i admin. */
export function saknadeBolagsuppgifter(c: CompanySettings): (keyof CompanySettings)[] {
  return (["org", "vat", "address", "postal", "phone"] as const).filter((k) => !c[k]?.trim());
}

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
    if (field) {
      const varde = row.value ?? DEFAULTS[field];
      result[field] = PLATSHALLARE[field] === varde ? "" : varde;
    }
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
