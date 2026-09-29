/**
 * notify.ts — den enda vägen ut för e-post.
 *
 * Före den här filen skickade fem funktioner mejl rakt mot Resend utan att
 * lämna något spår: ingen tabell, inget sparat svar, ingen idempotens. När det
 * kom för många mejl gick det inte att se vad som skickats eller varför --
 * orsaken fick läsas ur ett Python-skript i nattkörningen.
 *
 * Nu gäller två regler.
 *
 * 1. IDEMPOTENS LIGGER I DATABASEN. Varje utskick får en nyckel som beskriver
 *    HÄNDELSEN, inte anropet -- `rfq_customer:<rfq_id>`, inte ett slumptal.
 *    Raden skapas med `on conflict do nothing`; kom ingen rad tillbaka är
 *    mejlet redan skickat och vi gör ingenting. Två samtidiga anrop kan alltså
 *    inte båda vinna, eftersom det unika indexet avgör och inte koden.
 *
 * 2. RESULTATET SPARAS ALLTID. Lyckat utskick får Resends id, misslyckat får
 *    felet i klartext. En rad i `notifications` är svaret på frågan "skickades
 *    det här mejlet?", och den frågan gick tidigare inte att besvara.
 */

const RESEND_API = "https://api.resend.com/emails";

export interface Utskick {
  /** Vilken sorts mejl: rfq_customer, rfq_admin, order_status, claim, welcome, supplier_po, status_request. */
  kind: string;
  to: string;
  subject: string;
  html: string;
  /**
   * Beskriver HÄNDELSEN, inte anropet. Två anrop för samma händelse ska ge
   * samma nyckel -- det är hela skyddet mot dubbelutskick.
   */
  idempotencyKey: string;
  from?: string;
  /** Adresser som får en kopia, t.ex. adminlådan på offert och accept. */
  bcc?: string[];
  /** Dit svaret ska gå när avsändaren är noreply, t.ex. en leverantörs inköpsorder. */
  replyTo?: string;
  /** Bilagor, base64-kodade. Används av inköpsorderns PDF. */
  attachments?: Array<{ filename: string; content: string }>;
  /** Vad mejlet handlar om, så en rad går att spåra tillbaka. */
  ref?: { table: string; id: string };
  /** Sätts till true av nattkörningen och andra prov: raden skrivs, inget skickas. */
  torrkorning?: boolean;
}

export interface UtskickSvar {
  ok: boolean;
  /** true när mejlet redan var skickat och därför hoppades över. */
  redanSkickat: boolean;
  id: string | null;
  fel?: string;
}

const FRAN_STANDARD = "Maskinval <noreply@maskinval.se>";

/** Liten REST-hjälp: funktionerna har olika Supabase-klienter, den här är fristående. */
async function rest(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function skickaMejl(u: Utskick): Promise<UtskickSvar> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";

  // Steg 1 -- gör anspråk på utskicket. Kommer ingen rad tillbaka betyder det
  // att nyckeln redan fanns, alltså att mejlet redan är hanterat.
  let radId: string | null = null;
  try {
    const res = await rest("notifications", {
      method: "POST",
      headers: {
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        kind: u.kind,
        to_email: u.to,
        subject: u.subject,
        idempotency_key: u.idempotencyKey,
        status: "pending",
        ref_table: u.ref?.table ?? null,
        ref_id: u.ref?.id ?? null,
      }),
    });
    const rader = await res.json().catch(() => []);
    radId = Array.isArray(rader) && rader.length ? rader[0].id : null;
    if (!radId) {
      console.log(`notify: ${u.idempotencyKey} redan skickat — hoppar över`);
      return { ok: true, redanSkickat: true, id: null };
    }
  } catch (err) {
    // Loggen får aldrig hindra utskicket. Ett mejl som går fram utan rad är
    // sämre än ett med rad, men mycket bättre än inget mejl alls.
    console.error("notify: kunde inte skriva raden, skickar ändå:", err);
  }

  async function avsluta(status: string, extra: Record<string, unknown>) {
    if (!radId) return;
    await rest(`notifications?id=eq.${radId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, attempts: 1, ...extra }),
    }).catch((e) => console.error("notify: kunde inte uppdatera raden:", e));
  }

  if (u.torrkorning) {
    await avsluta("sent", { sent_at: new Date().toISOString(), provider_id: "torrkorning" });
    return { ok: true, redanSkickat: false, id: radId };
  }

  if (!resendKey) {
    await avsluta("failed", { last_error: "RESEND_API_KEY saknas" });
    return { ok: false, redanSkickat: false, id: radId, fel: "RESEND_API_KEY saknas" };
  }

  // Steg 2 -- skicka, och spara utfallet oavsett hur det gick.
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: u.from ?? FRAN_STANDARD,
        to: u.to,
        ...(u.bcc?.length ? { bcc: u.bcc } : {}),
        ...(u.replyTo ? { reply_to: u.replyTo } : {}),
        ...(u.attachments?.length ? { attachments: u.attachments } : {}),
        subject: u.subject,
        html: u.html,
      }),
    });
    const kropp = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fel = `Resend ${res.status}: ${JSON.stringify(kropp).slice(0, 400)}`;
      console.error("notify:", fel);
      await avsluta("failed", { last_error: fel });
      return { ok: false, redanSkickat: false, id: radId, fel };
    }
    await avsluta("sent", {
      sent_at: new Date().toISOString(),
      provider_id: (kropp as { id?: string }).id ?? null,
    });
    return { ok: true, redanSkickat: false, id: radId };
  } catch (err) {
    const fel = String(err).slice(0, 400);
    await avsluta("failed", { last_error: fel });
    return { ok: false, redanSkickat: false, id: radId, fel };
  }
}
