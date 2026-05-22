import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { PhysicsDimensions } from "./physics";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const AI_SEARCH_EDGE = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/ai-search";

// Server-side Supabase client (uses env vars available in Cloudflare Workers)
function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return createClient(url, key);
}

// Search the knowledge base for relevant chunks
async function searchKnowledge(query: string, limit = 6): Promise<string> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.rpc("search_knowledge", {
      query_text: query,
      match_count: limit,
    });
    if (error || !data?.length) return "";
    return data
      .map((c: { source_file: string; brand: string; content: string }) =>
        `[Source: ${c.brand} — ${c.source_file}]\n${c.content}`
      )
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

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
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("GROQ_API_KEY not set");
    return null;
  }
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      console.error("Groq error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("Groq call failed", e);
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

// ─── RAG: Ask anything — searches PDF knowledge base + answers with context ───
export const aiAskKnowledge = createServerFn({ method: "POST" })
  .inputValidator((d: { question: string; locale?: string }) => d)
  .handler(async ({ data }): Promise<{ answer: string; sources: string[]; source: "ai" | "fallback" }> => {
    const isSv = data.locale === "sv";

    // 1. Search knowledge base for relevant chunks
    const context = await searchKnowledge(data.question, 8);

    // 2. Build prompt with or without context
    const systemPrompt = [
      `You are an expert industrial automation engineer with deep knowledge of Parker, Bosch Rexroth, Norgren, Festo, SMC, and Camozzi products.`,
      `Answer questions accurately using the provided technical documentation context.`,
      `If the context contains the answer, cite the source file. If not in context, say so clearly — never invent specs or part numbers.`,
      langInstruction(data.locale),
    ].join(" ");

    const userPrompt = context
      ? `Technical documentation context:\n\n${context}\n\n---\n\nQuestion: ${data.question}`
      : `Question: ${data.question}\n\n(No specific documentation found — answer from general knowledge, clearly stating this.)`;

    const raw = await callGateway([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (raw) {
      // Extract source files mentioned
      const sourceMatches = context.match(/\[Source: [^\]]+\]/g) ?? [];
      const sources = [...new Set(sourceMatches.map((s) => s.replace(/\[Source: |\]/g, "")))];
      return { answer: raw.trim(), sources, source: "ai" };
    }

    return {
      answer: isSv
        ? "Kunde inte hämta svar just nu. Kontrollera din fråga och försök igen."
        : "Could not retrieve an answer right now. Please try again.",
      sources: [],
      source: "fallback",
    };
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

// Maps user description to catalog filter criteria — calls Supabase Edge Function (Gemini)
export const aiSearchProducts = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string; locale?: string }) => d)
  .handler(async ({ data }): Promise<AiSearchResult> => {
    try {
      const res = await fetch(AI_SEARCH_EDGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: data.query, locale: data.locale ?? "sv" }),
      });
      if (!res.ok) throw new Error(`Edge fn ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("aiSearchProducts edge fn failed", e);
      return fallbackSearch(data.query, data.locale === "sv");
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
  else if (/camozzi/.test(t)) result.brand_slug = "camozzi";

  const bore = /(\d{2,3})\s*mm/.exec(t)?.[1];
  if (bore) result.spec_filters.push({ key: "bore_mm", min: Number(bore) - 5, max: Number(bore) + 5 });

  const stroke = /slag\s*(\d{2,4})|(\d{2,4})\s*mm\s*slag/.exec(t);
  if (stroke) result.spec_filters.push({ key: "stroke_mm", min: Number(stroke[1] ?? stroke[2]) });

  return result;
}

// ─── Physics-aware dimension extraction ─────────────────────────────────────
// The LLM ONLY extracts raw numbers and category signals from text.
// All physics calculations (bore sizing, force, tech routing) happen
// in physics.ts — never delegated to the LLM.
export const aiExtractDimensions = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string; locale?: string }) => d)
  .handler(async ({ data }): Promise<PhysicsDimensions & { source: "ai" | "fallback" }> => {
    const prompt = `Extract ONLY the factual numbers and category signals from this industrial application description.
Return ONLY valid JSON with these optional fields:
{
  "mass_kg": number or null,            // load/mass in kg (convert lbs if needed)
  "distance_mm": number or null,        // stroke/travel distance in mm
  "force_n": number or null,            // force in Newtons if directly stated
  "bore_hint_mm": number or null,       // bore diameter if explicitly stated
  "speed": "slow"|"medium"|"fast"|"very_fast"|null,
  "precision": "low"|"medium"|"high"|"very_high"|null,
  "application": "linear_move"|"pick_and_place"|"gripping"|"vacuum_grip"|"rodless"|"rotary"|"general"|null,
  "environment": "standard"|"outdoor"|"food_grade"|"clean_room"|"atex"|"washdown"|null
}

RULES:
- If user says "repeatability", "high precision", "servo", "stepper" → precision = "high" or "very_high"
- If user says "pick and place" or similar → application = "pick_and_place"
- If user says "gripper" or "gripping" as the main task → application = "gripping"
- Convert any kg to kg, lbs multiply by 0.453
- Only return what is explicitly stated or strongly implied. Do NOT invent values.
- Return null for unknown fields, never omit them.
- NO prose, ONLY JSON.

User text: ${data.text}`;

    const raw = await callGateway([
      { role: "system", content: "You extract structured physical requirements from industrial engineering text. Return ONLY valid JSON. No prose." },
      { role: "user", content: prompt },
    ]);

    // Fallback: pure regex extraction
    const fb = fallbackDimExtract(data.text);

    if (!raw) return { ...fb, source: "fallback" };
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as PhysicsDimensions;
      // Merge: LLM result wins, fallback fills gaps
      return {
        mass_kg: parsed.mass_kg ?? fb.mass_kg,
        distance_mm: parsed.distance_mm ?? fb.distance_mm,
        force_n: parsed.force_n ?? fb.force_n,
        bore_hint_mm: parsed.bore_hint_mm ?? fb.bore_hint_mm,
        speed: parsed.speed ?? fb.speed,
        precision: parsed.precision ?? fb.precision,
        application: parsed.application ?? fb.application,
        environment: parsed.environment ?? fb.environment,
        source: "ai",
      };
    } catch {
      return { ...fb, source: "fallback" };
    }
  });

function fallbackDimExtract(text: string): PhysicsDimensions & { source: "fallback" } {
  const t = text.toLowerCase();
  const result: PhysicsDimensions & { source: "fallback" } = { source: "fallback" };

  // Mass — "10 kg", "10kg", "10 kilogram"
  const massM = /(\d+(?:[.,]\d+)?)\s*(?:kg|kilogram|kilo\b)/.exec(t);
  if (massM) result.mass_kg = parseFloat(massM[1].replace(",", "."));

  // lbs
  const lbsM = /(\d+(?:[.,]\d+)?)\s*(?:lbs?|pounds?)/.exec(t);
  if (lbsM && !result.mass_kg) result.mass_kg = parseFloat(lbsM[1]) * 0.4536;

  // Distance — "300 mm", "300mm", "300 millimeter"
  // Avoid matching bore sizes (short, e.g. "32mm bore")
  const distM = /(\d{2,4})\s*mm(?:\s+(?:slag|stroke|distance|sträcka|förflyttning|travel|move|rörelse))?/.exec(t);
  if (distM) result.distance_mm = Number(distM[1]);

  // Bore explicitly stated
  const boreM = /(\d{1,3})\s*mm\s*(?:bore|borr|kolvdiameter|piston)/.exec(t);
  if (boreM) result.bore_hint_mm = Number(boreM[1]);

  // Force in N
  const forceM = /(\d{2,5})\s*[nN](?!m\b)/.exec(t);
  if (forceM) result.force_n = Number(forceM[1]);

  // Speed
  if (/very fast|mycket snabb|extremt snabb/.test(t)) result.speed = "very_fast";
  else if (/\bfast\b|snabb|quick/.test(t)) result.speed = "fast";
  else if (/slow|långsam/.test(t)) result.speed = "slow";
  else if (/medium speed|medelhastighet/.test(t)) result.speed = "medium";

  // Precision
  if (/repeatab|repeterbar|high precision|hög precision|servo|stepper|stegmotor|exact pos/.test(t)) result.precision = "high";
  else if (/low precision|grov|approximate/.test(t)) result.precision = "low";

  // Application
  if (/pick.?and.?place|pnp/.test(t)) result.application = "pick_and_place";
  else if (/gripper|grip|klämm/.test(t)) result.application = "gripping";
  else if (/vacuum|vakuum|sug/.test(t)) result.application = "vacuum_grip";
  else if (/rodless|kolvstångslös/.test(t)) result.application = "rodless";

  // Environment
  if (/atex|explosion/.test(t)) result.environment = "atex";
  else if (/food|livsmedel|hygien/.test(t)) result.environment = "food_grade";
  else if (/outdoor|utomhus/.test(t)) result.environment = "outdoor";

  return result;
}
