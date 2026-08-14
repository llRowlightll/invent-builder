import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { PhysicsDimensions, PhysicsResult } from "./physics";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile decommissioned by Groq 2026-08-16. Moved to openai/gpt-oss-120b
// (Groq's production replacement — same fix as groq-advisor/index.ts's LLM_MODEL).
const GROQ_MODEL = "openai/gpt-oss-120b";
const AI_SEARCH_EDGE = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/ai-search";

/** Shared conversation message type for passing chat history to AI functions */
export type ChatMessage = { role: "user" | "assistant"; content: string };

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
  /** Pre-ranked SKUs from the ai-search edge function — shown first in results */
  ranked_skus?: string[];
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

async function callGateway(messages: { role: string; content: string }[], maxTokens = 1024): Promise<string | null> {
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
        max_tokens: maxTokens,
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
  .inputValidator((d: { question: string; locale?: string; history?: ChatMessage[] }) => d)
  .handler(async ({ data }): Promise<{ answer: string; sources: string[]; source: "ai" | "fallback" }> => {
    const isSv = data.locale === "sv";

    // 1. Search knowledge base for relevant chunks
    const context = await searchKnowledge(data.question, 8);

    // 2. Build prompt with or without context
    const systemPrompt = [
      `You are a senior automation engineer with deep knowledge of Parker, Bosch Rexroth, Norgren, Festo, SMC, and Camozzi products.`,
      `Answer directly and technically. No hedging, no uncertainty language — no "might", "could", "consider", "it depends" without immediate resolution.`,
      `State specific products, bore sizes, force calculations, and standards (ISO 15552, IEC 61131-3, PLd/SIL2) where relevant.`,
      `If the context contains the answer, cite the source. If not in context, answer from engineering knowledge and state this clearly.`,
      `Never invent part numbers. If a specific SKU is needed, describe the selection criteria instead.`,
      `Use conversation history to understand follow-up questions and references to previous answers.`,
      langInstruction(data.locale),
    ].join(" ");

    const userPrompt = context
      ? `Technical documentation context:\n\n${context}\n\n---\n\nQuestion: ${data.question}`
      : `Question: ${data.question}\n\n(No specific documentation found — answer from general knowledge, clearly stating this.)`;

    // Include up to 6 previous messages for context
    const history = (data.history ?? []).slice(-6);

    const raw = await callGateway([
      { role: "system", content: systemPrompt },
      ...history,
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
    const q = data.question ?? (
      data.locale === "sv"
        ? "Förklara i 2-3 meningar varför dessa produkter är korrekt dimensionerade. Ange specifika tekniska skäl — borrstorlek, kolvkraft, slaglängd eller precision."
        : "Explain in 2-3 sentences why these products are correctly sized. State specific technical reasons — bore size, piston force, stroke, or precision."
    );
    const raw = await callGateway([
      {
        role: "system",
        content: `You are a senior automation engineer. Be direct and technical. State why a product meets the requirement — bore, force, stroke, IP rating. Never say "might be suitable" or "could work". Never invent SKUs not in the context. ${langInstruction(data.locale)}`,
      },
      { role: "user", content: `Context:\n${data.context}\n\nTask: ${q}` },
    ]);
    if (raw) return { text: raw.trim(), source: "ai" };
    const fb =
      data.locale === "sv"
        ? "Produkterna är korrekt dimensionerade mot beräknad kolvkraft och slaglängd. Servodriften och styrenheten matchar motorns märkström och fieldbus-protokoll."
        : "Products are correctly sized against calculated piston force and stroke requirement. The servo drive and controller match the motor's rated current and fieldbus protocol.";
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
        body: JSON.stringify({ query: data.query, limit: 12 }),
      });
      if (!res.ok) throw new Error(`Edge fn ${res.status}`);

      const edgeData = await res.json() as {
        query: string;
        results: Array<{ sku: string; name: string; category: string; brand: string; match_reason: string; score: number }>;
        pdf_context_found: boolean;
      };

      const results = edgeData.results ?? [];
      if (results.length === 0) return fallbackSearch(data.query, data.locale !== "en");

      // Derive AiSearchResult fields from ranked results
      const topResult = results[0];
      const isSv = data.locale !== "en";
      const explanation = results.slice(0, 3)
        .map((r) => `${r.name}: ${r.match_reason}`)
        .join(". ") || (isSv ? `Sökresultat för "${data.query}".` : `Search results for "${data.query}".`);

      // Pick the dominant category from top results
      const categoryCounts: Record<string, number> = {};
      results.forEach((r) => { if (r.category) categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1; });
      const category_slug = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const brand_slug = topResult.brand?.toLowerCase().replace(/\s+/g, "-") || undefined;

      return {
        explanation,
        category_slug,
        brand_slug,
        keywords: data.query.split(/\s+/).filter((w) => w.length > 2),
        spec_filters: [],
        ranked_skus: results.map((r) => r.sku),
        source: "ai",
      };
    } catch (e) {
      console.error("aiSearchProducts edge fn failed", e);
      return fallbackSearch(data.query, data.locale !== "en");
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
  else if (/luft|frl|filter|regul/.test(t)) result.category_slug = "frl";
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
  .inputValidator((d: { text: string; locale?: string; history?: ChatMessage[] }) => d)
  .handler(async ({ data }): Promise<PhysicsDimensions & { source: "ai" | "fallback" }> => {
    // Build context hint from recent history so follow-ups like "smaller?" resolve correctly
    const historyContext = (data.history ?? []).slice(-4)
      .map(h => `${h.role === "user" ? "User" : "Assistant"}: ${h.content.slice(0, 200)}`)
      .join("\n");
    const contextPrefix = historyContext
      ? `Previous conversation context (use to resolve references like "smaller", "faster", etc.):\n${historyContext}\n\n`
      : "";

    const prompt = `${contextPrefix}Extract ONLY the factual numbers and category signals from this industrial application description.
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

// ─── Complete system design — 5-section engineering output ──────────────────
// Called when physics.isSystem === true (pick-and-place or multi-component systems).
// Generates a structured SUMMARY / ARCHITECTURE / BOM / ALTERNATIVES / NOTES output.
export const aiSystemDesign = createServerFn({ method: "POST" })
  .inputValidator((d: {
    dims: PhysicsDimensions;
    physics: Pick<PhysicsResult, "technology" | "reasoning" | "warnings" | "isSystem">;
    foundProducts: { label: string; skus: string[] }[];
    locale?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ design: string; source: "ai" | "fallback" }> => {
    const isSv = data.locale === "sv";

    const knowledgeQuery = [
      "pick and place system",
      data.physics.technology === "electric" ? "servo electric linear actuator drive controller" : "pneumatic cylinder gripper",
      data.dims.distance_mm ? `${data.dims.distance_mm}mm stroke` : "",
      data.dims.mass_kg ? `${data.dims.mass_kg}kg payload` : "",
    ].filter(Boolean).join(" ");

    const context = await searchKnowledge(knowledgeQuery, 8);

    const formatInstructions = isSv ? `
Generera en komplett systemdesign i detta EXAKTA format (använd exakt dessa rubriker):

## SYSTEMSAMMANFATTNING
Systemnamn: [kortfattat namn]
Kort beskrivning: [1-2 meningar: vad systemet gör, nyckelspecifikationer]
Varför denna lösning:
• [primärt teknikval med motivering]
• [arkitekturbeslut]
• [hanterat krav eller begränsning]

## SYSTEMARKITEKTUR
Styrflöde: [Styrenhet] → [Drivenhet] → [Aktuator] → [Sensor]
Gripkrets: [Ventil] → [Vakuumgenerator / aktuator] → [Sluteffektör]

## KOMPONENTLISTA (BOM)
Lista komponenter i grupper: ELEKTRISKT RÖRELSESYSTEM, STYRSYSTEM, PNEUMATISK SLUTEFFEKTÖR, SENSORER & SÄKERHET.
För varje komponent: beskrivning, en specifik produktrekommendation (märke + modell), antal.
Markera komponenter som inte uppfyller krav med: ⚠ Uppfyller inte kravet

## ALTERNATIV
2-3 alternativa märken/lösningar med likvärdighetsnotes.

## INGENJÖRSNOTERINGAR
3-5 korta precisa noteringar om kritiska integrationsbegränsningar (försörjning, jordning, kabelhantering, compliance).
` : `
Generate a complete system design in this STRICT format (use these exact section headers):

## SYSTEM SUMMARY
System name: [concise name]
Short description: [1-2 sentences: what it does, key performance specs]
Why this solution:
• [primary technology choice justification]
• [architecture decision]
• [key constraint addressed]

## SYSTEM ARCHITECTURE
Control flow: [Controller] → [Drive] → [Actuator] → [Sensor]
Gripper circuit: [Valve] → [Vacuum generator / actuator] → [End-effector]

## COMPONENT LIST (BOM)
List components in groups: ELECTRIC MOTION SYSTEM, CONTROL SYSTEM, PNEUMATIC END-EFFECTOR, SENSORS & SAFETY.
For each component: description, one specific product recommendation (brand + model), quantity.
Mark any component that does not meet requirements as: ⚠ Does not meet requirement

## ALTERNATIVES
2-3 alternative brands/solutions with equivalence notes.

## ENGINEERING NOTES
3-5 short precise notes on critical integration constraints (utilities, grounding, cable management, compliance).
`;

    const rules = isSv ? `
REGLER:
- Elektrisk aktuator → systemet MÅSTE innehålla servomotor + servodrivenhet + rörelsestyrenhet
- Pneumatiska komponenter ENDAST för gripdon/sluteffektör — inte för huvudrörelseaxlar
- Inget osäkerhetsspråk. Inga ord som "kan", "bör övervägas", "möjligen". Var direkt och tekniskt precis.
- Om ett krav är odefinierat: ange exakt vilken parameter som måste specificeras innan komponenten kan väljas
- Separera tydligt ELEKTRISKA och PNEUMATISKA delsystem
` : `
RULES:
- Electric actuator → system MUST include servo motor + servo drive + motion controller
- Pneumatic components ONLY for gripper/end-effector — NOT for main motion axes
- No uncertainty language. No "might", "could", "consider", "may be suitable". Be direct and technically precise.
- If a requirement is undefined: state exactly what parameter must be specified before that component can be selected
- Clearly separate ELECTRIC and PNEUMATIC subsystems
`;

    const reqSummary = [
      data.dims.mass_kg != null ? `Payload: ${data.dims.mass_kg} kg` : null,
      data.dims.distance_mm != null ? `Stroke: ${data.dims.distance_mm} mm` : null,
      data.dims.precision ? `Precision: ${data.dims.precision}` : null,
      data.dims.speed ? `Speed: ${data.dims.speed}` : null,
      data.dims.environment && data.dims.environment !== "standard" ? `Environment: ${data.dims.environment}` : null,
      ...data.physics.reasoning,
    ].filter(Boolean).join("\n");

    const prompt = [
      formatInstructions,
      rules,
      `\nExtracted requirements:\n${reqSummary || (isSv ? "Inga parametrar specificerade — ange krav i varje BOM-post." : "No parameters specified — note requirements in each BOM entry.")}`,
      context ? `\nProduct knowledge from documentation:\n${context}` : "",
      `\n${isSv ? "Besvara på svenska." : "Answer in English."}`,
    ].join("\n");

    const raw = await callGateway([
      {
        role: "system",
        content: isSv
          ? "Du är en senior automationsingenjör på ett systemintegratörsföretag. Generera kompletta systemdesigns med specifika produktrekommendationer. Inget osäkerhetsspråk. Separera alltid elektriska och pneumatiska delsystem tydligt."
          : "You are a senior automation engineer at a systems integrator. Generate complete system designs with specific product recommendations. No uncertainty language. Always clearly separate electric and pneumatic subsystems.",
      },
      { role: "user", content: prompt },
    ], 2048);

    if (raw) return { design: raw.trim(), source: "ai" };

    // Structured fallback — deterministic based on technology type
    const fallback = isSv ? `## SYSTEMSAMMANFATTNING

**Systemnamn:** Elektrisk servostation för pick & place
**Kort beskrivning:** 3-axligt kartesiskt rörelsesystem med elektriska linjärmoduler och vakuumsluteffektör för högprecisions pick & place.

**Varför denna lösning:**
• Elektrisk servostyrning ger repeterbarhet ≤±0,5 mm — uppnås inte med pneumatik
• Kartesisk 3-axlig arkitektur matchar definierat XYZ-rörelsefönster
• Vakuumgripdon specificerat för slät platt plockyta
• EtherCAT fieldbus möjliggör synkroniserad fleraxelsstyrning

---

## SYSTEMARKITEKTUR

**Styrflöde:**
Rörelsestyrenhet → Servoenhet (×3) → Servomotorer → Linjärmoduler (X, Y, Z)

**Gripkrets:**
Solenoidventil → Vakuumgenerator → Sugkopp → Delnärvarosensor

---

## KOMPONENTLISTA (BOM)

**ELEKTRISKT RÖRELSESYSTEM**
| Komponent | Rekommendation | Antal |
|---|---|---|
| Linjärmodul X-axel | Festo ELGC-BS-KF-100-300 | 1 |
| Linjärmodul Y-axel | Festo ELGC-BS-KF-100-200 | 1 |
| Linjärmodul Z-axel | Festo ELGE-TB-KF-55-100 | 1 |
| Servomotor | Festo EMMS-AS-56-S-HS | 3 |
| Servodrivenhet | Festo CMMT-AS-C2-3A | 3 |

**STYRSYSTEM**
| Komponent | Rekommendation | Antal |
|---|---|---|
| Rörelsestyrenhet | Festo CPX-E (EtherCAT-master) | 1 |
| Digital I/O-modul | Festo CPX-E-8DE-8DA | 1 |
| 24 V-strömförsörjning | 10 A DIN-skensmonterad PSU | 1 |

**PNEUMATISK SLUTEFFEKTÖR**
| Komponent | Rekommendation | Antal |
|---|---|---|
| Vakuumgenerator | Festo VADM-200-P-T2-M12 | 1 |
| Sugkopp | Festo ESG-40-BN (40 mm bälg) | 1 |
| Delnärvarosensor | Festo SFTB-4000-EP | 1 |
| Solenoidventil | Festo VUVG-L10-M52-AT-G18-1P3 | 1 |

**SENSORER & SÄKERHET**
| Komponent | Rekommendation | Antal |
|---|---|---|
| Ändlägesgivare | Festo SME-8M (per axel) | 3 |
| Säkerhetsrelä | Pilz PNOZ s4 (kat. 3 / PLd) | 1 |
| Nödstopp | Schmersal AZ 16-03ZVK | 1 |

---

## ALTERNATIV

• **Servoenhet + motor:** Siemens V90 + 1FL6 — direktbyte, föredras om Siemens S7-1500 är fabriksstandard
• **Linjärmoduler:** Bosch Rexroth MKK + kulskruv — likvärdig prestanda, högre enhetskostnad
• **Rörelsestyrenhet:** Beckhoff CX2020 + EL7211 — högsta cykelhastigheten (>5 cykler/sek), EtherCAT-native

---

## INGENJÖRSNOTERINGAR

• Tryckluftsförsörjning 5–6 bar krävs vid maskinen för vakuumgeneratorn — bekräfta fabriksförsörjning
• Kabelkedjor (Igus E2-serien) krävs på alla rörliga axlar — specificera kabellängd och böjningsradius
• Alla servoenheternas DC-bussanslutningar måste jordas till maskinramen
• Standardmoduler är IP20 — IP54-varianter krävs vid kylmedeldimma eller damm` : `## SYSTEM SUMMARY

**System name:** Electric Servo Pick-and-Place Station
**Short description:** 3-axis Cartesian electric linear motion system with vacuum end-effector for high-speed, high-precision pick-and-place.

**Why this solution:**
• Electric servo actuation selected for repeatability ≤±0.5 mm — not achievable with pneumatics
• Cartesian 3-axis architecture matches defined XYZ motion envelope
• Vacuum end-effector for smooth flat pick surface
• EtherCAT fieldbus enables synchronized multi-axis motion

---

## SYSTEM ARCHITECTURE

**Control flow:**
Motion Controller → Servo Drives (×3) → Servo Motors → Linear Modules (X, Y, Z)

**Gripper circuit:**
Solenoid valve → Vacuum generator → Suction cup → Part-present sensor

---

## COMPONENT LIST (BOM)

**ELECTRIC MOTION SYSTEM**
| Component | Recommendation | Qty |
|---|---|---|
| Linear module X-axis | Festo ELGC-BS-KF-100-300 (300 mm stroke) | 1 |
| Linear module Y-axis | Festo ELGC-BS-KF-100-200 (200 mm stroke) | 1 |
| Linear module Z-axis | Festo ELGE-TB-KF-55-100 (100 mm stroke) | 1 |
| Servo motor | Festo EMMS-AS-56-S-HS | 3 |
| Servo drive | Festo CMMT-AS-C2-3A | 3 |

**CONTROL SYSTEM**
| Component | Recommendation | Qty |
|---|---|---|
| Motion controller | Festo CPX-E (EtherCAT master) | 1 |
| Digital I/O module | Festo CPX-E-8DE-8DA | 1 |
| 24 VDC power supply | 10 A DIN-rail PSU | 1 |

**PNEUMATIC END-EFFECTOR**
| Component | Recommendation | Qty |
|---|---|---|
| Vacuum generator | Festo VADM-200-P-T2-M12 | 1 |
| Suction cup | Festo ESG-40-BN (40 mm bellows) | 1 |
| Part-present sensor | Festo SFTB-4000-EP | 1 |
| Solenoid valve | Festo VUVG-L10-M52-AT-G18-1P3 | 1 |

**SENSORS & SAFETY**
| Component | Recommendation | Qty |
|---|---|---|
| End-position sensor | Festo SME-8M (per axis) | 3 |
| Safety relay | Pilz PNOZ s4 (Cat. 3 / PLd) | 1 |
| Emergency stop | Schmersal AZ 16-03ZVK | 1 |

---

## ALTERNATIVES

• **Servo drives + motors:** Siemens V90 + 1FL6 — direct replacement, preferred if Siemens S7-1500 is plant standard
• **Linear modules:** Bosch Rexroth MKK + ballscrew — equivalent performance, higher unit cost
• **Motion controller:** Beckhoff CX2020 + EL7211 — highest cycle rate (>5 cycles/sec), EtherCAT native

---

## ENGINEERING NOTES

• Compressed air 5–6 bar required at machine for vacuum generator — confirm plant supply
• Cable chains (Igus E2 series) required on all moving axes — specify travel length and bending radius
• All servo drive DC bus connections must be grounded to machine frame
• Standard modules are IP20 — IP54 variants required if coolant mist or dust present`;

    return { design: fallback, source: "fallback" };
  });

// ─── Vision chat — identify component/machine from image ────────────────────
// Uses Anthropic claude-haiku-4-5 (vision). Falls back gracefully if no API key.
export const aiVisionChat = createServerFn({ method: "POST" })
  .inputValidator((d: { imageBase64: string; mimeType: string; question?: string; locale?: string; history?: ChatMessage[] }) => d)
  .handler(async ({ data }): Promise<{ text: string; searchQuery: string | null; error: string | null }> => {
    const { imageBase64, mimeType, question, locale } = data;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        text: locale === "sv"
          ? "Bildanalys är inte aktiverad. Sätt ANTHROPIC_API_KEY i miljövariablerna."
          : "Image analysis is not enabled. Set ANTHROPIC_API_KEY in environment variables.",
        searchQuery: null,
        error: "no_key",
      };
    }

    const isSv = locale === "sv";
    const defaultQ = isSv
      ? "Vad är detta för komponent? Identifiera tillverkare och modell om möjligt, beskriv vad den gör och ge rekommendationer för ersättning eller relaterade produkter."
      : "What is this component? Identify manufacturer and model if possible, describe what it does, and give recommendations for replacement or related products.";

    const searchHint = isSv
      ? 'Inkludera i slutet av ditt svar ett JSON-block med denna exakta form (på en rad): <search>{"query":"sökterm","category":"slug eller null"}</search>'
      : 'Include at the end of your response a JSON block in this exact form (one line): <search>{"query":"search term","category":"slug or null"}</search>';
    const userPrompt = (question?.trim() || defaultQ) + "\n\n" + searchHint;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 700,
          system: isSv
            ? "Du är en expert på industriell automation och hjälper B2B-kunder att identifiera komponenter och hitta lösningar. Svara alltid på svenska."
            : "You are an industrial automation expert helping B2B customers identify components and find solutions.",
          messages: [
            // Previous text exchanges for context
            ...(data.history ?? []).slice(-4).map(h => ({
              role: h.role,
              content: h.content,
            })),
            // Current message with image
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
                { type: "text", text: userPrompt },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Anthropic vision error:", errText);
        return {
          text: isSv ? "Bildanalys misslyckades. Försök igen." : "Image analysis failed. Please try again.",
          searchQuery: null,
          error: "api_error",
        };
      }

      const result = await res.json() as { content: Array<{ type: string; text: string }> };
      const raw = result.content?.[0]?.text ?? "";

      // Extract the search hint
      const searchMatch = raw.match(/<search>([\s\S]*?)<\/search>/);
      let searchQuery: string | null = null;
      if (searchMatch) {
        try {
          const hint = JSON.parse(searchMatch[1]);
          searchQuery = hint.query ?? null;
        } catch { /* ignore */ }
      }

      // Clean the response text
      const cleanText = raw.replace(/<search>[\s\S]*?<\/search>/g, "").trim();

      return { text: cleanText, searchQuery, error: null };
    } catch (err) {
      console.error("aiVisionChat error:", err);
      return {
        text: isSv ? "Bildanalys misslyckades. Kontrollera anslutningen." : "Image analysis failed. Check your connection.",
        searchQuery: null,
        error: String(err),
      };
    }
  });
