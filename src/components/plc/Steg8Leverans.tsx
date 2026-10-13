import { Link } from "@tanstack/react-router";
import { arKomplett, exportJson, exportMarkdown, exportSignalerCsv, leveransstatus, VARNINGSTEXT, type Leveransstatus } from "@/lib/plc/leverans";
import type { Underlag } from "@/lib/plc/modell";
import type { Tx } from "./delad";
import { Statusmarke } from "@/components/design/Statusmarke";
import type { Tillstand } from "@/lib/design/status";

const STATUSTEXT: Record<Leveransstatus, { sv: string; en: string; tillstand: Tillstand }> = {
  komplett: { sv: "Komplett", en: "Complete", tillstand: "bekraftat" },
  ofullstandigt: { sv: "Ofullständigt", en: "Incomplete", tillstand: "komplettering" },
  saknas: { sv: "Saknas", en: "Missing", tillstand: "komplettering" },
  ej_tillgangligt: { sv: "Ej tillgängligt", en: "Not available", tillstand: "ejProvat" },
  ej_utfort: { sv: "Inte utfört", en: "Not performed", tillstand: "ejProvat" },
};

function ladda(namn: string, innehall: string, typ: string) {
  const blob = new Blob([innehall], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Exportens Markdown som enkel HTML för utskrift: rubriker, tabeller, listor, citat. */
function somHtml(md: string): string {
  const ut: string[] = [];
  const rader = md.split("\n");
  for (let i = 0; i < rader.length; i++) {
    const r = rader[i];
    if (r.startsWith("|")) {
      const tabell: string[] = [];
      while (i < rader.length && rader[i].startsWith("|")) tabell.push(rader[i++]);
      i--;
      const celler = (x: string) => x.slice(1, -1).split(/(?<!\\)\|/).map((c) => esc(c.trim().replace(/\\\|/g, "|")));
      ut.push(`<table><thead><tr>${celler(tabell[0]).map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tabell.slice(2).map((t) => `<tr>${celler(t).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    } else if (r.startsWith("### ")) ut.push(`<h3>${esc(r.slice(4))}</h3>`);
    else if (r.startsWith("## ")) ut.push(`<h2>${esc(r.slice(3))}</h2>`);
    else if (r.startsWith("# ")) ut.push(`<h1>${esc(r.slice(2))}</h1>`);
    else if (r.startsWith(">")) ut.push(`<p class="varning">${esc(r.replace(/^>\s?/, "")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`);
    else if (r.startsWith("- ")) ut.push(`<li>${esc(r.slice(2)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`);
    else if (r.trim() === "---") ut.push("<hr>");
    else if (r.trim()) ut.push(`<p>${esc(r).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>")}</p>`);
  }
  return ut.join("\n");
}

/**
 * Steg 8: statusarna och exporterna. Ett ofullständigt underlag går att
 * exportera -- märkt som ofullständigt. Ingenting här markerar kod som
 * genererad, kompilerad eller simulerad; inget verktyg är anslutet.
 */
export function Steg8Leverans({ tx, locale, underlag, projektnamn, revision }: {
  tx: Tx; locale: string; underlag: Underlag; projektnamn: string; revision: number;
}) {
  const rader = leveransstatus(underlag);
  const komplett = arKomplett(underlag);
  const meta = { projektnamn, underlagsrevision: revision, datum: new Date().toISOString().slice(0, 10) };
  const filnamn = `${projektnamn.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "underlag"}-rev${revision}`;

  function skrivUt() {
    const f = window.open("", "_blank");
    if (!f) return;
    f.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(projektnamn)} — rev ${revision}</title>
<style>body{font:12px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:20px;border-bottom:1px solid #ccc}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f2f2f2}
.varning{background:#fff4e5;border:1px solid #f0b46b;padding:6px 8px}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style></head>
<body>${somHtml(exportMarkdown(underlag, meta))}</body></html>`);
    f.document.close();
    f.focus();
    f.print();
  }

  return (
    <div className="mt-3 space-y-6">
      <p className="rounded-lg border border-warning-deep/20 bg-warning-surface px-3 py-2 text-sm text-warning-deep">⚠️ {VARNINGSTEXT}</p>

      <section aria-labelledby="status-rubrik">
        <h3 id="status-rubrik" className="text-sm font-semibold text-foreground">{tx("Status", "Status")}</h3>
        <ul className="kort mt-2 divide-y divide-line">
          {rader.map((r) => {
            const st = STATUSTEXT[r.status];
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{r.namn}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{r.text}</span>
                </span>
                <Statusmarke tillstand={st.tillstand} text={tx(st.sv, st.en)} locale={locale} className="shrink-0" />
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="export-rubrik" className="space-y-2">
        <h3 id="export-rubrik" className="text-sm font-semibold text-foreground">{tx("Exportera", "Export")}</h3>
        {!komplett && (
          <p className="text-sm text-foreground">
            {tx(
              "Underlaget är ofullständigt. Det går att exportera ändå, och varje export är märkt OFULLSTÄNDIGT, med revision, antaganden och öppna frågor.",
              "The documentation is incomplete. It can still be exported, and every export is marked INCOMPLETE, with revision, assumptions and open questions.",
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => ladda(`${filnamn}.md`, exportMarkdown(underlag, meta), "text/markdown;charset=utf-8")}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors hover:border-cta/40">
            {tx("Hela underlaget (Markdown)", "Full documentation (Markdown)")}
          </button>
          <button type="button" onClick={() => ladda(`${filnamn}-io.csv`, "﻿" + exportSignalerCsv(underlag.signaler), "text/csv;charset=utf-8")}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors hover:border-cta/40">
            {tx("I/O-lista (CSV)", "I/O list (CSV)")}
          </button>
          <button type="button" onClick={() => ladda(`${filnamn}.json`, exportJson(underlag, meta), "application/json")}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors hover:border-cta/40">
            JSON
          </button>
          <button type="button" onClick={skrivUt}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors hover:border-cta/40">
            {tx("Skriv ut", "Print")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {tx(
            "Plattformsexport (t.ex. taggtabell till TIA Portal) och programförslag finns inte än: ett format släpps först när importen provats i det riktiga verktyget.",
            "Platform export (e.g. a tag table for TIA Portal) and program proposals do not exist yet: a format is released only once the import has been tried in the real tool.",
          )}
        </p>
      </section>

      {underlag.omfattning.leverans === "ingenjor" && (
        <section className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <h3 className="font-semibold text-foreground">{tx("Hjälp av automationsingenjör", "Help from an automation engineer")}</h3>
          <p className="text-muted-foreground">
            {tx(
              "Exportera underlaget och skicka det med en förfrågan. Inget skickas automatiskt.",
              "Export the documentation and send it with a request. Nothing is sent automatically.",
            )}
          </p>
          <Link to="/$locale/advisor" params={{ locale: locale as never }} search={{ q: tx(`Hjälp med programmeringsunderlaget för ${projektnamn} (rev ${revision}).`, `Help with the programming documentation for ${projektnamn} (rev ${revision}).`) } as never}
            className="inline-block text-info hover:underline">
            {tx("Till kontaktsidan", "To the contact page")} →
          </Link>
        </section>
      )}
    </div>
  );
}
