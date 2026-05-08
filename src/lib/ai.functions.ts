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
  if (!out.voltage) out.followups.push("What supply voltage — 230VAC or 400VAC?");
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

export const aiExtractRequirements = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => d)
  .handler(async ({ data }): Promise<ExtractedReqs & { source: "ai" | "fallback" }> => {
    const fb = fallbackExtract(data.text);
    const prompt = `Extract industrial linear axis requirements from the user's text. Return ONLY valid JSON with these optional keys: stroke_mm (number, mm), force_n (number, Newtons), voltage ("230VAC"|"400VAC"), fieldbus ("PROFINET"|"EthernetIP"|"none"), feedback ("incremental"|"absolute"), ip ("IP54"|"IP65"|"IP67"), followups (array of short strings asking for missing critical info: stroke, force, voltage). No prose.\n\nUser: ${data.text}`;
    const raw = await callGateway([
      { role: "system", content: "You extract structured requirements. JSON only." },
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
  .inputValidator((d: { context: string; question?: string }) => d)
  .handler(async ({ data }): Promise<{ text: string; source: "ai" | "fallback" }> => {
    const q = data.question ?? "Explain this bill of materials in 4-6 sentences for a maintenance engineer.";
    const raw = await callGateway([
      {
        role: "system",
        content:
          "You are a senior automation engineer. Be concise, technical, and never invent SKUs that aren't in the context.",
      },
      { role: "user", content: `Context:\n${data.context}\n\nTask: ${q}` },
    ]);
    if (raw) return { text: raw.trim(), source: "ai" };
    return {
      text: "This bundle pairs the actuator with a matching servo drive, 24V power supply, PLC and feedback. Cables and mounting accessories complete the assembly. Spares are added in BEST mode for uptime.",
      source: "fallback",
    };
  });
