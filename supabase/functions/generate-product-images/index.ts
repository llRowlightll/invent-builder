import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FAL_API_KEY = Deno.env.get("FAL_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const BUCKET = "product-images";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const CAT_DETAIL: Record<string, string> = {
  "Cylinder": "pneumatic cylinder with silver aluminum body, piston rod extended, tie-rod construction, port fittings",
  "Electric Actuator": "electric linear actuator with servo motor, precision ball screw, anodized aluminum housing",
  "Gripper": "pneumatic gripper with parallel jaw fingers, precision gripping mechanism, compact body",
  "Valve Terminal": "pneumatic valve terminal manifold with solenoid valves, LED indicators, multi-pin connector",
  "Air Preparation": "pneumatic FRL filter-regulator-lubricator service unit with bowl, pressure gauge, modular design",
  "Vacuum": "vacuum ejector generator with suction cup, integrated silencer, push-in fittings",
  "Rotary": "rotary actuator with rack-and-pinion mechanism, adjustable angle stop, pneumatic drive",
  "Sensor": "industrial sensor with LED status indicator, M12 connector, stainless housing",
  "Drive": "servo drive controller with terminal blocks, status display, DIN rail mount",
};

function buildPrompt(brand: string, _name: string, family: string, category: string): string {
  const detail = CAT_DETAIL[category] ?? "industrial automation component, precision engineering";
  return (
    `Professional product studio photograph of a ${brand} ${family}, ${detail}. ` +
    `Pure white seamless background, soft studio lighting, photorealistic, ` +
    `sharp focus, 3/4 angle view, no text, no watermarks, industrial catalog style.`
  );
}

async function generateWithPollinations(prompt: string): Promise<Uint8Array> {
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function generateWithFal(prompt: string, apiKey: string): Promise<Uint8Array> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_size: "square_hd", num_inference_steps: 4, num_images: 1, output_format: "jpeg" }),
  });
  if (!res.ok) throw new Error(`fal.ai: ${await res.text()}`);
  const data = await res.json();
  const imgRes = await fetch(data.images[0].url);
  return new Uint8Array(await imgRes.arrayBuffer());
}

async function generateWithDalle(prompt: string, apiKey: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "standard", response_format: "url" }),
  });
  if (!res.ok) throw new Error(`DALL-E: ${await res.text()}`);
  const data = await res.json();
  const imgRes = await fetch(data.data[0].url);
  return new Uint8Array(await imgRes.arrayBuffer());
}

async function generateWithReplicate(prompt: string, apiKey: string): Promise<Uint8Array> {
  const startRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { prompt, go_fast: true, num_outputs: 1, output_format: "jpg", output_quality: 90 } }),
  });
  if (!startRes.ok) throw new Error(`Replicate start: ${await startRes.text()}`);
  let pred = await startRes.json();
  for (let i = 0; i < 30; i++) {
    if (pred.status === "succeeded") break;
    if (pred.status === "failed") throw new Error(`Replicate: ${pred.error}`);
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    pred = await pollRes.json();
  }
  const imgRes = await fetch(pred.output[0]);
  return new Uint8Array(await imgRes.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const { product_id, batch_size = 5, provider = "pollinations", api_key } = body;

  const resolvedKey =
    api_key ??
    (provider === "dalle" ? OPENAI_API_KEY :
     provider === "replicate" ? (Deno.env.get("REPLICATE_API_KEY") ?? "") :
     provider === "fal" ? FAL_API_KEY : "");

  if (provider !== "pollinations" && !resolvedKey) {
    return new Response(
      JSON.stringify({ error: `Ingen API-nyckel för provider "${provider}".` }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await supabase.storage
    .createBucket(BUCKET, { public: true, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] })
    .catch(() => {});

  let q = supabase
    .from("products")
    .select("id, sku, name, family, brands(name), categories(name)")
    .is("image_url", null);
  if (product_id) q = q.eq("id", product_id);
  else q = q.limit(batch_size);

  const { data: products, error: fetchErr } = await q;
  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: fetchErr.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ id: string; sku: string; status: string; url?: string; error?: string }> = [];

  for (const p of products ?? []) {
    try {
      const brand = (p.brands as any)?.name ?? "Industrial";
      const category = (p.categories as any)?.name ?? "Component";
      const prompt = buildPrompt(brand, p.name, p.family ?? p.name, category);

      let imgBytes: Uint8Array;
      switch (provider) {
        case "dalle":      imgBytes = await generateWithDalle(prompt, resolvedKey); break;
        case "replicate":  imgBytes = await generateWithReplicate(prompt, resolvedKey); break;
        case "fal":        imgBytes = await generateWithFal(prompt, resolvedKey); break;
        default:           imgBytes = await generateWithPollinations(prompt); break;
      }

      const fileName = `${p.sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, imgBytes, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      await supabase.from("products").update({ image_url: publicUrl }).eq("id", p.id);

      results.push({ id: p.id, sku: p.sku, status: "ok", url: publicUrl });
      console.log(`✓ ${p.sku}`);
    } catch (err) {
      console.error(`✗ ${p.sku}:`, err);
      results.push({ id: p.id, sku: p.sku, status: "error", error: String(err) });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
