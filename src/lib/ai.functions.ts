import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface ExtractedReqs {
  stroke_mm?: number;
  force_n?: number;
  voltage?: "230VAC" | "400VAC";
  fieldbus?: "PROFINET" | "EthernetIP" | "none";
  feedback?: "incremental" | "absolute";
  ip?: "IP54" | "IP65" | "IP67";
  followups?: string[];
}

export interface AiSearchResult {
  explanation: string;
  category_slug?: string;
  brand_slug?: string;
  keywords: string[];
  spec_filters: { key: string; min?: number; max?: number; exact?: string }[];
  followup?: string;
  source: "ai" | "fallback";
}

function fallbackExtract(text: string): ExtractedReqs {
  const t = text.toLowerCase();
  const stroke = /(\d{2,4})\s*mm/.exec(t)?.[1];
  const force = /(\d{2,5})\s*n(?!m)/.exec(t)?.[1];
  const out: ExtractedReqs = {};
  if (stroke) out.stroke_mm = Number(stroke);
  if (force) out.force_n = Number(force);
  if (/400\s*v/.test(t)) out.voltage = "400VAC";
  else if (/230\s*v/.test(t)) out.voltage = "230VAC";
  if (/profinet|pn/.test(t)) out.fieldbus = "PROFINET";
  else if (/ethernet\s*ip|eip/.test(t)) out.fieldbus = "EthernetIP";
  if (/absolut/.test(t)) out.feedback = "absolute";
  else if (/inkremental|incremental/.test(t)) out.feedback = "incremental";
  if (/ip67/.test(t)) out.ip = "IP67";
  else if (/ip65/.test(t)) out.ip = "IP65";
  else if (/ip54/.test(t)) out.ip = "IP54";
  out.followups = [];
  if (!out.stroke_mm) out.followups.push("What stroke length do you need (mm)?");
  if (!out.force_n) out.followups.push("What pushing/pulling force do you need (N)?");
  return out;
}

async function callGateway(messages: { role: string; content: string }[]): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("AI gateway call failed", e);
    return null;
  }
}

function langInstruction(locale?: string) {
  return locale === "sv"
    ? "Respond ONLY in Swedish. Never mix languages."
    : "Respond ONLY in English. Never mix languages.";
}

export const aiExtractRequirements = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string; locale?: string }) => d)
  .handler(async ({ data }): Promise<ExtractedReqs & { source: "ai" | "fallback" }> => {
    const fb = fallbackExtract(data.text);
    const prompt = `Extract industrial linear axis requirements from the user's text. Return ONLY valid JSON with these optional keys: stroke_mm (number, mm), force_n (number, Newtons), voltage ("230VAC"|"400VAC"), fieldbus ("PROFINET"|"EthernetIP"|"none"), feedback ("incremental"|"absolute"), ip ("IP54"|"IP65"|"IP67"), followups (array of 2-5 short strings asking for missing critical info — write the followups in ${data.locale === "sv" ? "Swedish" : "English"}). No prose.\n\nUser: ${data.text}`;
    const raw = await callGateway([
      { role: "system", content: `You extract structured requirements. JSON only. ${langInstruction(data.locale)}` },
      { role: "user", content: prompt },
    ]);
    if (!raw) return { ...fb, source: "fallback" };
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return { ...fb, ...parsed, source: "ai" };
    } catch {
      return { ...fb, source: "fallback" };
    }
  });

export const aiExplain = createServerFn({ method: "POST" })
  .inputValidator((d: { context: string; question?: string; locale?: string }) => d)
  .handler(async ({ data }): Promise<{ text: string; source: "ai" | "fallback" }> => {
    const q = data.question ?? "Explain this bill of materials in 4-6 sentences for a maintenance engineer.";
    const raw = await callGateway([
      {
        role: "system",
        content: `You are a senior automation engineer. Be concise, technical, and never invent SKUs that aren't in the context. ${langInstruction(data.locale)}`,
      },
      { role: "user", content: `Context:\n${data.context}\n\nTask: ${q}` },
    ]);
    if (raw) return { text: raw.trim(), source: "ai" };
    const fb =
      data.locale === "sv"
        ? "Detta paket parar aktuatorn med en matchande servodrift, 24 V-strömförsörjning, PLC och återkoppling. Kablar och monteringstillbehör kompletterar enheten."
        : "This bundle pairs the actuator with a matching servo drive, 24V power supply, PLC and feedback. Cables and mounting accessories complete the assembly.";
    return { text: fb, source: "fallback" };
  });

// Maps user description to catalog filter criteria using Gemini
export const aiSearchProducts = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string; locale?: string }) => d)
  .handler(async ({ data }): Promise<AiSearchResult> => {
    const isSv = data.locale === "sv";

    const CATEGORY_SLUGS = [
      "cylinder",
      "electric-actuator",
      "valve-terminal",
      "valve",
      "gripper",
      "air-preparation",
      "vacuum",
      "linear-module",
    ];
    const BRAND_SLUGS = ["festo", "smc", "parker", "bosch-rexroth", "norgren"];

    const systemPrompt = `Du är en senior automationsingenjör specialiserad på industriell pneumatik och elektriska aktuatorer.
Katalogen innehåller produkter med dessa kategorier: ${CATEGORY_SLUGS.join(", ")}.
Varumärken: ${BRAND_SLUGS.join(", ")}.
Produkter har specifikationer som: bore_mm, stroke_mm, force_n, operating_pressure_bar, flow_rate_lpm, voltage, fieldbus, ip_rating.

Din uppgift: tolka användarens sökfråga och returnera ENBART giltig JSON (inget annat) med dessa fält:
{
  "explanation": "Kort ${isSv ? "svensk" : "english"} förklaring av vad du förstod (1-2 meningar)",
  "category_slug": "en av kategorierna ovan eller null",
  "brand_slug": "ett av varumärkena ovan eller null",
  "keywords": ["relevanta", "sökord", "från", "frågan"],
  "spec_filters": [
    { "key": "bore_mm", "min": 40, "max": 63 },
    { "key": "stroke_mm", "min": 100 }
  ],
  "followup": "En följdfråga om något kritiskt saknas, annars null"
}
${langInstruction(data.locale)}`;

    const raw = await callGateway([
      { role: "system", content: systemPrompt },
      { role: "user", content: data.query },
    ]);

    if (!raw) {
      return fallbackSearch(data.query, isSv);
    }

    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return { ...parsed, source: "ai" };
    } catch {
      return fallbackSearch(data.query, isSv);
    }
  });

function fallbackSearch(query: string, isSv: boolean): AiSearchResult {
  const t = query.toLowerCase();
  const result: AiSearchResult = {
    explanation: isSv
      ? `Visar resultat för "${query}".`
      : `Showing results for "${query}".`,
    keywords: query.split(/\s+/).filter((w) => w.length > 2),
    spec_filters: [],
    source: "fallback",
  };

  if (/cylind|kolv/.test(t)) result.category_slug = "cylinder";
  else if (/ventil|valve/.test(t)) result.category_slug = "valve";
  else if (/grepp|gripper|klämm/.test(t)) result.category_slug = "gripper";
  else if (/vakuum|vacuum|sug/.test(t)) result.category_slug = "vacuum";
  else if (/luft|frl|filter|regul/.test(t)) result.category_slug = "air-preparation";
  else if (/elektrisk|servo|linjär/.test(t)) result.category_slug = "electric-actuator";

  if (/festo/.test(t)) result.brand_slug = "festo";
  else if (/\bsmc\b/.test(t)) result.brand_slug = "smc";
  else if (/parker/.test(t)) result.brand_slug = "parker";
  else if (/bosch|rexroth/.test(t)) result.brand_slug = "bosch-rexroth";
  else if (/norgren/.test(t)) result.brand_slug = "norgren";

  const bore = /(\d{2,3})\s*mm/.exec(t)?.[1];
  if (bore) result.spec_filters.push({ key: "bore_mm", min: Number(bore) - 5, max: Number(bore) + 5 });

  const stroke = /slag\s*(\d{2,4})|(\d{2,4})\s*mm\s*slag/.exec(t);
  if (stroke) result.spec_filters.push({ key: "stroke_mm", min: Number(stroke[1] ?? stroke[2]) });

  return result;
}
