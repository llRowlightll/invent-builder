/**
 * Mejlen i orderns resa, utan IO: samma data som kundens spårningssida
 * (orderns_resa), en text per händelse. Provas i groq-advisor/orderhandelse.test.ts.
 */
import { escapeHtml, safeHref } from "../_shared/html.ts";

export const SITE = "https://maskinval.se";

export interface ResaSteg { kod: string; klar: boolean; delvis?: boolean; tid: string | null }
export interface ResaRad { line_no: number; sku: string; name: string; qty: number; status: string; skickat: number }
export interface ResaForsandelse {
  id: string; nr: number | null; fraktbolag: string | null; sparningsnummer: string | null; url: string | null;
  skickad: string | null; beraknad: string | null; levererad: string | null; status: string;
  rader: { sku: string; name: string; qty: number }[] | null;
}
export interface Resa {
  order_number: string | null; status: string; avbruten: boolean; kund: string; po_number: string | null;
  eta: string | null; eta_kalla: string; steg: ResaSteg[]; rader: ResaRad[]; forsandelser: ResaForsandelse[];
}

export type Handelse = "mottagen" | "bekraftad" | "skickad" | "levererad";

const FRAKTBOLAG: Record<string, string> = {
  postnord: "PostNord", dhl: "DHL", schenker: "DB Schenker", bring: "Bring", ups: "UPS", fedex: "FedEx", dsv: "DSV", annat: "Fraktbolag",
};

export function datumText(d: string | null): string {
  if (!d) return "";
  const dt = new Date(`${d.slice(0, 10)}T12:00:00Z`);
  return dt.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
}

function steg(r: Resa, kod: string): ResaSteg | undefined {
  return r.steg.find((s) => s.kod === kod);
}

/** Ska händelsen mejlas nu? Läser det som faktiskt hänt, inte vad anroparen säger. */
export function borSkickas(r: Resa, h: Handelse, shipmentId: string | null): boolean {
  if (r.avbruten) return false;
  if (h === "mottagen") return true;
  if (h === "bekraftad") return Boolean(steg(r, "bekraftad")?.klar);
  if (h === "levererad") return Boolean(steg(r, "levererad")?.klar);
  return Boolean(shipmentId && r.forsandelser.some((f) => f.id === shipmentId));
}

export function idempotensnyckel(orderId: string, h: Handelse, shipmentId: string | null): string {
  return h === "skickad" ? `resa:${orderId}:skickad:${shipmentId}` : `resa:${orderId}:${h}`;
}

function knapp(href: string, text: string) {
  return `<a href="${href}" style="display:inline-block;background:#1d3a6e;color:#fff;padding:11px 18px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>`;
}

function ram(innehall: string) {
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1e293b;padding:22px 32px;border-radius:12px 12px 0 0;">
    <span style="color:#f59e0b;font-size:22px;font-weight:700;">M</span>
    <span style="color:#fff;font-size:18px;font-weight:600;margin-left:8px;">Maskinval</span>
  </td></tr>
  <tr><td style="background:#fff;padding:30px 32px;border-radius:0 0 12px 12px;color:#1e293b;font-size:15px;line-height:1.55;">${innehall}</td></tr>
  <tr><td style="padding:18px;text-align:center;"><p style="color:#94a3b8;font-size:11px;margin:0;">Maskinval · <a href="${SITE}" style="color:#94a3b8;">maskinval.se</a> · Svara på mejlet om du har frågor</p></td></tr>
</table></td></tr></table></body></html>`;
}

/** Stegraden överst, som i en leveransapp. */
function stegrad(r: Resa) {
  const namn: Record<string, string> = { mottagen: "Mottagen", bestalld: "Beställd", bekraftad: "Bekräftad", skickad: "På väg", levererad: "Levererad" };
  const celler = r.steg.map((s) => {
    const farg = s.klar ? "#16a34a" : s.delvis ? "#f59e0b" : "#cbd5e1";
    return `<td align="center" style="font-size:11px;color:${s.klar || s.delvis ? "#1e293b" : "#94a3b8"};padding:0 2px;">
      <div style="height:6px;border-radius:3px;background:${farg};margin-bottom:6px;"></div>${namn[s.kod] ?? s.kod}</td>`;
  }).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr>${celler}</tr></table>`;
}

function etaRad(r: Resa) {
  if (!r.eta || r.eta_kalla === "levererad") return "";
  const ca = r.eta_kalla === "uppskattning" ? "ca " : "";
  return `<p style="margin:0 0 18px;padding:12px 16px;background:#f0f9ff;border-radius:8px;">
    <span style="font-size:12px;color:#0369a1;font-weight:600;letter-spacing:.04em;">BERÄKNAD LEVERANS</span><br>
    <strong style="font-size:18px;">${ca}${escapeHtml(datumText(r.eta))}</strong></p>`;
}

export function byggMejl(r: Resa, h: Handelse, orderId: string, shipmentId: string | null): { amne: string; html: string } {
  const nr = escapeHtml(r.order_number ?? orderId.slice(0, 8).toUpperCase());
  const hej = r.kund ? `Hej ${escapeHtml(r.kund)},` : "Hej,";
  const resaUrl = `${SITE}/sv/order/${orderId}`;
  const ocUrl = `${SITE}/sv/oc/${orderId}`;
  const folj = knapp(resaUrl, "Följ ordern");

  if (h === "mottagen") {
    const rader = r.rader.map((x) => `<li>${escapeHtml(String(x.qty))} × ${escapeHtml(x.sku)} <span style="color:#64748b;">${escapeHtml(x.name)}</span></li>`).join("");
    return {
      amne: `Vi har tagit emot din beställning ${nr}`,
      html: ram(`<p style="margin:0 0 6px;color:#64748b;">${hej}</p>
        <h1 style="margin:0 0 14px;font-size:21px;">Tack! Vi har tagit emot din beställning ${nr}.</h1>
        ${stegrad(r)}${etaRad(r)}
        <p style="margin:0 0 10px;">Vi beställer nu hos tillverkaren och hör av oss när den bekräftat leveransdagen.</p>
        <ul style="margin:0 0 20px;padding-left:18px;font-size:14px;">${rader}</ul>
        <p style="margin:0 0 10px;">${folj}</p>
        <p style="margin:0;font-size:13px;"><a href="${ocUrl}" style="color:#1d3a6e;">Visa orderbekräftelsen</a></p>`),
    };
  }

  if (h === "bekraftad") {
    return {
      amne: `Din order ${nr} är bekräftad${r.eta ? ` – leverans ${datumText(r.eta)}` : ""}`,
      html: ram(`<p style="margin:0 0 6px;color:#64748b;">${hej}</p>
        <h1 style="margin:0 0 14px;font-size:21px;">Din order ${nr} är bekräftad av tillverkaren.</h1>
        ${stegrad(r)}${etaRad(r)}
        <p style="margin:0 0 20px;">Du får ett mejl med spårningsnummer när den skickas.</p>
        <p style="margin:0;">${folj}</p>`),
    };
  }

  if (h === "skickad") {
    const f = r.forsandelser.find((x) => x.id === shipmentId)!;
    const antal = r.forsandelser.length;
    const allt = Boolean(steg(r, "skickad")?.klar);
    const del = !allt || antal > 1 ? ` (försändelse ${f.nr ?? antal}${allt ? ` av ${antal}` : ""})` : "";
    const sparUrl = safeHref(f.url);
    const innehall = (f.rader ?? []).map((x) => `<li>${escapeHtml(String(x.qty))} × ${escapeHtml(x.sku)} <span style="color:#64748b;">${escapeHtml(x.name)}</span></li>`).join("");
    return {
      amne: `Din order ${nr} är på väg${del}`,
      html: ram(`<p style="margin:0 0 6px;color:#64748b;">${hej}</p>
        <h1 style="margin:0 0 14px;font-size:21px;">Din order ${nr} är på väg${del}.</h1>
        ${stegrad(r)}
        <p style="margin:0 0 18px;padding:12px 16px;background:#f0fdf4;border-radius:8px;">
          <span style="font-size:12px;color:#166534;font-weight:600;letter-spacing:.04em;">${escapeHtml(FRAKTBOLAG[(f.fraktbolag ?? "").toLowerCase()] ?? "Fraktbolag")}</span><br>
          <strong style="font-size:18px;font-family:monospace;">${escapeHtml(f.sparningsnummer ?? "")}</strong>
          ${f.beraknad ? `<br><span style="font-size:14px;">Beräknad leverans: <strong>${escapeHtml(datumText(f.beraknad))}</strong></span>` : ""}
        </p>
        ${innehall ? `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">I paketet:</p><ul style="margin:0 0 20px;padding-left:18px;font-size:14px;">${innehall}</ul>` : ""}
        <p style="margin:0;">${sparUrl ? `${knapp(sparUrl, "Spåra paketet")}&nbsp; ` : ""}<a href="${resaUrl}" style="color:#1d3a6e;font-size:14px;">Följ hela ordern</a></p>`),
    };
  }

  return {
    amne: `Din order ${nr} är levererad`,
    html: ram(`<p style="margin:0 0 6px;color:#64748b;">${hej}</p>
      <h1 style="margin:0 0 14px;font-size:21px;">Din order ${nr} är levererad.</h1>
      ${stegrad(r)}
      <p style="margin:0 0 12px;">Tack för beställningen. Fakturan kommer separat.</p>
      <p style="margin:0 0 20px;">Är något fel eller saknas? Svara på det här mejlet så löser vi det.</p>
      <p style="margin:0;">${folj}</p>`),
  };
}
