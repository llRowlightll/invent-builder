import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { unzipSync } from "fflate";
import { giltigMarginal, misstankMarginal, saljpris } from "@/lib/marginal";
import {
  avkodaText, byggIndex, gissaAvgransare, iKronor, lasPrislista, marginalUrRad, matcha, omatchadeCsv, sammanfatta,
  type KatalogArtikel, type Prisrad, type Status,
} from "@/lib/prisfil";
import { lasXlsx } from "@/lib/xlsx-las";
import { hamtaValutakurs } from "@/lib/valuta.functions";

export const Route = createFileRoute("/$locale/admin/pricing")({
  component: AdminPricingPage,
});

// ── types ─────────────────────────────────────────────────────────────────────
type Brand = { id: string; name: string };
type Cat   = { id: string; name: string };
type Row   = {
  id: string; sku: string; name: string;
  purchase_price: number | null; margin: number | null;
  brand: Brand; category: Cat; brand_id: string; category_id: string;
  is_family: boolean;
};
// Shape returned by the admin_list_product_pricing() RPC (flat brand/category names).
type PricingRpcRow = {
  id: string; sku: string; name: string;
  purchase_price: number | null; margin: number | null;
  brand_id: string; category_id: string;
  brand_name: string | null; category_name: string | null;
  is_family: boolean | null;
};
type Proposal = {
  sku: string; name: string; brand: string;
  purchase_price: number;
  confidence: "high" | "medium" | "low";
  evidence: string;
  currency_note?: string;
};
type ProposalRow = Proposal & {
  selected: boolean;
  margin: string;   // editable by admin
  /** Artiklarna priset sparas på (fler än en när artikeln ligger dubbelt i katalogen). */
  ids: string[];
  status: Status;
  via: string;
  anm: string[];
  /** Pris per styck i filens valuta; purchase_price är omräknat till kronor. */
  prisOriginal: number;
  valuta: string;
  levKod: string | null;
  forpackning: number;
};
type Leverantor = { id: string; name: string; slug: string; is_active: boolean | null };

const STATUSTEXT: Record<Status, string> = {
  match: "Matchad",
  kontrollera: "Kontrollera",
  flera: "Flera möjliga",
  serie: "Serie",
  saknas: "Finns inte i katalogen",
  utan_pris: "Pris saknas",
  dubblett: "Dubblett",
};

const EDGE = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/extract-prices";

// ── helpers ───────────────────────────────────────────────────────────────────
// Marginalen är bruttomarginal i PROCENT; formeln och gränserna ligger i
// src/lib/marginal.ts, samma som offertverktygets leverantörsinläsning.
function sellPrice(pp: number | null, margin: string | null | number): string {
  const mg = typeof margin === "string" ? Number(margin) : margin;
  if (misstankMarginal(margin)) return "marginal < 1 %?";
  if (pp == null || mg == null || isNaN(pp) || isNaN(mg) || mg >= 100) return "—";
  return saljpris(pp, mg).toLocaleString("sv-SE", {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }) + " kr";
}

function confidenceBadge(c: "high" | "medium" | "low") {
  const styles: Record<string, string> = {
    high:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    low:    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  };
  const labels: Record<string, string> = { high: "Hög", medium: "Medel", low: "Låg" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${styles[c]}`}>
      {labels[c]}
    </span>
  );
}

// ── PDF extraction (client-side via pdfjs-dist) ───────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    // Use CDN worker to avoid bundling issues
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc   = await page.getTextContent();
      parts.push(tc.items.map((item) => ("str" in item ? (item.str ?? "") : "")).join(" "));
    }
    return parts.join("\n");
  } catch (err) {
    console.error("PDF extraction failed:", err);
    throw new Error("Kunde inte läsa PDF. Prova att klistra in texten manuellt.");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminPricingPage() {
  const [tab, setTab] = useState<"list" | "intake">("list");

  // ── Prislista state ────────────────────────────────────────────────────────
  const [rows,       setRows]       = useState<Row[]>([]);
  const [brands,     setBrands]     = useState<Brand[]>([]);
  const [cats,       setCats]       = useState<Cat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCat,   setFilterCat]   = useState("");
  const [saving,     setSaving]     = useState<string | null>(null);
  const [edited,     setEdited]     = useState<Record<string, { pp: string; margin: string }>>({});
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null);
  const [bulkBrand,  setBulkBrand]  = useState("");
  const [bulkCat,    setBulkCat]    = useState("");
  const [bulkMargin, setBulkMargin] = useState("");
  const [bulking,    setBulking]    = useState(false);

  // ── Prisintag state ────────────────────────────────────────────────────────
  const [inputText,   setInputText]   = useState("");
  const [analyzing,   setAnalyzing]   = useState(false);
  const [proposals,   setProposals]   = useState<ProposalRow[]>([]);
  const [intakeMsg,   setIntakeMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [saving2,     setSaving2]     = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Prislistefil: leverantör, valutakurser och raderna som inte kan sparas.
  const [extraNycklar, setExtraNycklar] = useState<Record<string, string[]>>({});
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([]);
  const [levId,       setLevId]       = useState("");
  const [kurser,      setKurser]      = useState<Record<string, { kurs: string; datum?: string; fel?: string }>>({});
  const [ejSparbara,  setEjSparbara]  = useState<Prisrad[]>([]);
  const [filnamn,     setFilnamn]     = useState("");

  useEffect(() => { load(); }, []);

  // ── data loading ───────────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const [{ data: ps }, { data: bs }, { data: cs }, { data: sup }, { data: ex }] = await Promise.all([
      // purchase_price/margin are admin-only cost data. The authenticated role no
      // longer has column SELECT on them, so they are read via a SECURITY DEFINER
      // RPC (admin-gated) rather than a direct table query.
      (supabase as any).rpc("admin_list_product_pricing"),
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("categories").select("id,name").order("name"),
      // Leverantörerna (admin) och de extra nummer prislistan kan matcha på.
      (supabase as any).from("suppliers").select("id,name,slug,is_active").order("name"),
      supabase.from("product_specs").select("product_id,value").in("key", ["type_code", "catalogue_part_no"]),
    ]);
    setLeverantorer(((sup ?? []) as Leverantor[]).filter((l) => l.slug !== "provleverantor"));
    const nycklar: Record<string, string[]> = {};
    for (const r of (ex ?? []) as { product_id: string; value: unknown }[]) {
      if (r.value == null) continue;
      (nycklar[r.product_id] ??= []).push(String(r.value));
    }
    setExtraNycklar(nycklar);
    setRows(((ps ?? []) as PricingRpcRow[]).map((d) => ({
      id: d.id, sku: d.sku, name: d.name,
      purchase_price: d.purchase_price, margin: d.margin,
      brand_id: d.brand_id, category_id: d.category_id,
      brand: { id: d.brand_id, name: d.brand_name ?? "—" },
      category: { id: d.category_id, name: d.category_name ?? "—" },
      is_family: d.is_family ?? false,
    })) as Row[]);
    setBrands((bs ?? []) as Brand[]);
    setCats((cs ?? []) as Cat[]);
    setLoading(false);
  }

  // ── Prislista helpers ──────────────────────────────────────────────────────
  function getVal(id: string, field: "pp" | "margin", fallback: number | null) {
    return edited[id]?.[field] ?? (fallback != null ? String(fallback) : "");
  }
  function setVal(id: string, field: "pp" | "margin", v: string) {
    setEdited((e) => ({ ...e, [id]: { ...e[id], [field]: v } }));
  }

  async function saveRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const ppStr = edited[id]?.pp   ?? (row.purchase_price != null ? String(row.purchase_price) : "");
    const mgStr = edited[id]?.margin ?? (row.margin        != null ? String(row.margin)         : "");
    const newPp = ppStr !== "" ? Number(ppStr) : null;
    const newMg = mgStr !== "" ? Number(mgStr) : null;
    setSaving(id);
    setMsg(null);
    const { error } = await supabase.from("products")
      .update({ purchase_price: newPp, margin: newMg, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(null);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: `✓ Sparat${newPp && newMg != null ? ` — säljpris: ${sellPrice(newPp, newMg)}` : ""}`, ok: true });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, purchase_price: newPp, margin: newMg } : r));
      setEdited((e) => { const n = { ...e }; delete n[id]; return n; });
      setTimeout(() => setMsg(null), 4000);
    }
  }

  /** Artikelns egen marginal när den är ett rimligt procenttal, annars 20
   *  (ägarens standard sedan 2026-11-12: inköp 100 kr → säljpris 125 kr).
   *  Förut fick varje inläst rad 30 %, oavsett artikelns egen marginal. */
  const standardMarginal = (sku: string): string =>
    String(giltigMarginal(rows.find((r) => r.sku === sku)?.margin));

  const misstankta = rows.filter((r) => misstankMarginal(r.margin)).length;
  const [rattar, setRattar] = useState(false);

  /**
   * Ägarens knapp. 0,35 kom från kolumnens gamla bråktalsstandard; raderna
   * (mest AVENTICS- och Parker-cylindrar) får samma marginal som de flesta
   * andra artiklar i sin kategori -- 22 % för cylindrar och ventiler, 30 %
   * eller 40 % för andra -- i stället för en gissad siffra.
   */
  function kategorinsMarginal(): { catId: string; namn: string; marginal: number; antal: number }[] {
    const ut: { catId: string; namn: string; marginal: number; antal: number }[] = [];
    const perKat = new Map<string, Row[]>();
    for (const r of rows) perKat.set(r.category_id, [...(perKat.get(r.category_id) ?? []), r]);
    for (const [catId, lista] of perKat) {
      const fel = lista.filter((r) => misstankMarginal(r.margin)).length;
      if (fel === 0) continue;
      const rakna = new Map<number, number>();
      for (const r of lista) if (r.margin != null && r.margin >= 1 && r.margin <= 95) rakna.set(r.margin, (rakna.get(r.margin) ?? 0) + 1);
      const vanligast = [...rakna.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 30;
      ut.push({ catId, namn: lista[0]?.category?.name ?? "Okategoriserad", marginal: vanligast, antal: fel });
    }
    return ut;
  }

  async function rattaBraktal() {
    const plan = kategorinsMarginal();
    const text = plan.map((p) => `${p.namn}: ${p.antal} st → ${p.marginal} %`).join("\n");
    if (!window.confirm(`Rätta marginalen 0,35 % till kategorins vanliga marginal?\n\n${text}`)) return;
    setRattar(true);
    let fel: string | null = null;
    for (const p of plan) {
      const q = supabase.from("products")
        .update({ margin: p.marginal, updated_at: new Date().toISOString() });
      const { error } = await (p.catId ? q.eq("category_id", p.catId) : q.is("category_id", null))
        .gt("margin", 0).lt("margin", 1);
      if (error) { fel = error.message; break; }
    }
    setRattar(false);
    if (fel) setMsg({ text: `Fel: ${fel}`, ok: false });
    else { setMsg({ text: "✓ Marginalerna under 1 % rättade efter kategori", ok: true }); await load(); }
  }

  async function bulkUpdate() {
    if (!bulkMargin) return;
    setBulking(true);
    let q = supabase.from("products")
      .update({ margin: Number(bulkMargin), updated_at: new Date().toISOString() });
    if (bulkBrand) q = q.eq("brand_id", bulkBrand);
    if (bulkCat)   q = q.eq("category_id", bulkCat);
    const { error } = await q;
    setBulking(false);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: `✓ Marginal uppdaterad till ${bulkMargin}%`, ok: true });
      await load();
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterBrand && r.brand_id   !== filterBrand) return false;
      if (filterCat   && r.category_id !== filterCat)  return false;
      if (q && !`${r.sku} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterBrand, filterCat]);

  // ── Prisintag: PDF upload ──────────────────────────────────────────────────
  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfLoading(true);
    try {
      const text = await extractPdfText(file);
      setInputText((prev) => prev ? prev + "\n\n---\n\n" + text : text);
    } catch (err: unknown) {
      setIntakeMsg({ text: (err as Error).message, ok: false });
    } finally {
      setPdfLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Prisintag: prislista som Excel eller CSV ───────────────────────────────
  // Läsning och matchning i src/lib/prisfil.ts: vårt nummer, tillverkarens
  // (även utan våra prefix och med Excels tappade nollor), leverantörens eget.
  const katalog = useMemo<KatalogArtikel[]>(() => rows.map((r) => ({
    id: r.id, sku: r.sku, name: r.name, brand: r.brand?.name ?? null, is_family: r.is_family,
    purchase_price: r.purchase_price, extraNycklar: extraNycklar[r.id],
  })), [rows, extraNycklar]);

  /** Valutakursen (kronor per enhet) som används för en valuta, eller null. */
  function kursFor(valuta: string): number | null {
    if (valuta === "SEK") return 1;
    const k = Number(String(kurser[valuta]?.kurs ?? "").replace(",", "."));
    return k > 0 ? k : null;
  }

  async function hamtaKurs(valuta: string) {
    if (valuta === "SEK" || kurser[valuta]?.kurs) return;
    try {
      const svar = await hamtaValutakurs({ data: { valuta } });
      setKurser((k) => ({ ...k, [valuta]: "kurs" in svar
        ? { kurs: String(svar.kurs), datum: svar.datum }
        : { kurs: "", fel: `${svar.fel} -- skriv in kursen själv.` } }));
    } catch {
      setKurser((k) => ({ ...k, [valuta]: { kurs: "", fel: "Kunde inte hämta kursen -- skriv in den själv." } }));
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIntakeMsg(null);
    setEjSparbara([]);
    setFilnamn(file.name);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Filen är större än 20 MB. Dela upp den eller spara bara prisbladet.");
      const namn = file.name.toLowerCase();
      if (namn.endsWith(".xls")) throw new Error("Det gamla Excel-formatet (.xls) läses inte. Öppna filen och spara den som .xlsx eller CSV.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let tabell: unknown[][];
      if (namn.endsWith(".xlsx") || namn.endsWith(".xlsm") || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
        tabell = lasXlsx(unzipSync(bytes));
      } else {
        const text = avkodaText(bytes);
        tabell = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false, delimiter: gissaAvgransare(text) }).data;
      }
      const ut = lasPrislista(tabell, katalog);
      if (ut.fel) throw new Error(ut.fel);
      const kol = ut.kolumner!;
      const data = tabell.slice(kol.rubrikrad + 1);
      const sparbara = ut.rader.filter((r) => r.status === "match" || r.status === "kontrollera");
      const list: ProposalRow[] = sparbara.map((r) => {
        const fil = marginalUrRad(data[r.rad - kol.rubrikrad - 2] ?? [], kol);
        return {
          sku: r.artikel!.sku, name: r.artikel!.name, brand: r.artikel!.brand ?? "",
          purchase_price: r.valuta === "SEK" ? r.pris! : 0,
          confidence: r.status === "match" ? "high" : "medium",
          evidence: `rad ${r.rad}: ${r.kod}${r.namn ? ` (${r.namn})` : ""}`,
          selected: r.status === "match",
          margin: fil != null ? String(fil) : standardMarginal(r.artikel!.sku),
          ids: (r.alla ?? [r.artikel!]).map((a) => a.id),
          status: r.status, via: r.via, anm: r.anm,
          prisOriginal: r.pris!, valuta: r.valuta, levKod: r.levKod, forpackning: r.forpackning,
        };
      });
      setProposals(list);
      setEjSparbara(ut.rader.filter((r) => r.status !== "match" && r.status !== "kontrollera"));
      for (const v of new Set(list.map((p) => p.valuta))) void hamtaKurs(v);
      const sum = sammanfatta(ut.rader);
      if (list.length === 0) {
        setIntakeMsg({ text: `Ingen rad i filen matchade katalogen (${ut.rader.length} rader lästa). Listan nedan visar varför.`, ok: false });
      } else {
        setIntakeMsg({
          text: `${ut.rader.length} rader lästa: ${sum.match} matchade, ${sum.kontrollera} att kontrollera, ` +
            `${sum.saknas + sum.serie + sum.flera + sum.utan_pris + sum.dubblett} kan inte sparas. Granska och bekräfta nedan.`,
          ok: true,
        });
      }
    } catch (err: unknown) {
      setProposals([]);
      setIntakeMsg({ text: (err as Error).message, ok: false });
    } finally {
      if (csvRef.current) csvRef.current.value = "";
    }
  }

  function laddaNerEjSparbara() {
    const url = URL.createObjectURL(new Blob([omatchadeCsv(ejSparbara)], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ej-inlasta-${(filnamn || "prislista").replace(/\.[^.]+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export every active product as a CSV template — sku/name/brand pre-filled,
  // inköpspris empty to fill in. Re-imports through "Ladda upp CSV" above.
  function downloadTemplate() {
    const esc = (s: string | null) => (s ?? "").replace(/;/g, ",").replace(/[\r\n]+/g, " ").trim();
    // `typ` column: "familj" = configure-to-order series (set a nominal price);
    // "specifik" = real article number (VLOOKUP against the supplier price list).
    // The CSV import ignores this column on re-upload (it matches sku/price/margin).
    const header = "artikelnummer;namn;marke;typ;inkopspris;marginal";
    const body = rows.map((r) =>
      `${esc(r.sku)};${esc(r.name)};${esc(r.brand?.name ?? "")};${r.is_family ? "familj" : "specifik"};${r.purchase_price ?? ""};${r.margin ?? 20}`
    );
    const csv = "﻿" + [header, ...body].join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `maskinval-prislista-mall-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Prisintag: analyze ─────────────────────────────────────────────────────
  async function analyze() {
    if (!inputText.trim()) return;
    setAnalyzing(true);
    setProposals([]);
    setIntakeMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(EDGE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json() as { proposals?: Proposal[]; error?: string };
      if (data.error) throw new Error(data.error);
      // AI:ns artikelnummer matchas som en prislisterad: en sku som inte finns
      // i katalogen kan inte sparas (förut räknades den som "sparad").
      const index = byggIndex(katalog);
      const list: ProposalRow[] = [];
      const utanArtikel: string[] = [];
      for (const p of data.proposals ?? []) {
        const t = matcha(p.sku, index);
        if (!(t.status === "match" || t.status === "kontrollera") || !t.artikel) { utanArtikel.push(p.sku); continue; }
        list.push({
          ...p, sku: t.artikel.sku, name: t.artikel.name,
          selected: t.status === "match" && p.confidence !== "low",
          margin: standardMarginal(t.artikel.sku),  // artikelns egen marginal; admin kan ändra
          ids: [t.artikel.id], status: t.status, via: t.via, anm: [],
          prisOriginal: p.purchase_price, valuta: "SEK", levKod: null, forpackning: 1,
        });
      }
      setEjSparbara([]);
      const utan = utanArtikel.length ? ` ${utanArtikel.length} matchade ingen artikel i katalogen: ${utanArtikel.slice(0, 8).join(", ")}${utanArtikel.length > 8 ? " …" : ""}.` : "";
      if (list.length === 0) {
        setIntakeMsg({ text: `Inga priser att spara.${utan || " Kontrollera att texten innehåller priser och artikelnummer."}`, ok: false });
      } else {
        setIntakeMsg({ text: `${list.length} pris${list.length !== 1 ? "er" : ""} hittades — granska och bekräfta nedan.${utan}`, ok: true });
      }
      setProposals(list);
    } catch (err: unknown) {
      setIntakeMsg({ text: `Fel: ${(err as Error).message}`, ok: false });
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Prisintag: confirm selected ────────────────────────────────────────────
  // Varje uppdatering läser tillbaka raden: en sku som inte finns ger 0 rader
  // utan fel, och räknades förut som sparad.
  async function confirmSelected() {
    const toSave = proposals.filter((p) => p.selected);
    if (!toSave.length) return;
    const utanKurs = [...new Set(toSave.filter((p) => kursFor(p.valuta) == null).map((p) => p.valuta))];
    if (utanKurs.length) {
      setIntakeMsg({ text: `Ange valutakursen för ${utanKurs.join(", ")} (kronor per enhet) innan priserna sparas.`, ok: false });
      return;
    }
    setSaving2(true);
    setIntakeMsg(null);
    let saved = 0;
    const fel: string[] = [];
    const idag = new Date().toISOString();
    for (const p of toSave) {
      const kr = iKronor(p.prisOriginal, p.valuta, kursFor(p.valuta));
      const mg = Number(String(p.margin).replace(",", "."));
      if (kr == null || !(kr > 0)) { fel.push(`${p.sku}: inget pris`); continue; }
      let ok = true;
      for (const id of p.ids) {
        const { data, error } = await supabase.from("products")
          .update({ purchase_price: kr, margin: isNaN(mg) ? null : mg, updated_at: idag })
          .eq("id", id)
          .select("id");
        if (error || !data?.length) { ok = false; fel.push(`${p.sku}: ${error?.message ?? "artikeln uppdaterades inte"}`); }
      }
      if (ok && levId) {
        const { error } = await (supabase as any).from("supplier_products").upsert({
          supplier_id: levId, product_id: p.ids[0],
          supplier_sku: p.levKod || p.evidence.replace(/^rad \d+: /, "").replace(/ \(.*$/, "") || p.sku,
          supplier_name: p.name, purchase_price: p.prisOriginal, currency: p.valuta,
          price_source: "price_list", price_valid_from: idag.slice(0, 10),
          pack_size: p.forpackning > 1 ? p.forpackning : null, last_verified_at: idag,
          notes: filnamn ? `Inläst ur ${filnamn}` : null,
        }, { onConflict: "supplier_id,supplier_sku" });
        if (error) { ok = false; fel.push(`${p.sku} (leverantörsraden): ${error.message}`); }
      }
      if (ok) saved++;
    }
    setSaving2(false);
    if (fel.length === 0) {
      setIntakeMsg({ text: `✓ ${saved} pris${saved !== 1 ? "er" : ""} sparade${levId ? " (även hos leverantören)" : ""}.`, ok: true });
      setProposals([]);
      setInputText("");
    } else {
      setIntakeMsg({ text: `${saved} sparade, ${fel.length} fel. Första: ${fel.slice(0, 3).join(" · ")}`, ok: false });
      setProposals((prev) => prev.filter((p) => !p.selected || fel.some((f) => f.startsWith(p.sku))));
    }
    await load();
  }

  const pricedCount = rows.filter((r) => r.purchase_price != null).length;
  const selectedCount = proposals.filter((p) => p.selected).length;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="container-page py-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prissättning</h1>
          <p className="text-sm text-muted-foreground">
            {pricedCount} av {rows.length} produkter har inköpspris
          </p>
          <p className="text-xs text-muted-foreground">
            Marginalen räknas på säljpriset: 20 % ger inköp × 1,25 (100 kr → 125 kr, varav 25 kr är din del).
            Ange inköpspriset exkl. moms.
          </p>
          {misstankta > 0 && (
            <p className="mt-2 text-sm text-destructive">
              {misstankta} artiklar har marginalen 0,35 % – kolumnens gamla standard var ett bråktal
              (0,35 = 35 %), men marginalen räknas i procent. Med ett inköpspris blir säljpriset då
              i praktiken inköpspriset, och de visas inte på sajten.{" "}
              <button onClick={rattaBraktal} disabled={rattar}
                className="underline font-medium disabled:opacity-50">
                {rattar ? "Rättar…" : "Ge dem kategorins vanliga marginal"}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["list", "intake"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition rounded-t-md border-b-2 -mb-px
              ${tab === t
                ? "border-info text-info"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "list" ? "Prislista" : "Prisintag (AI)"}
          </button>
        ))}
      </div>

      {/* ── TAB: Prislista ──────────────────────────────────────────────────── */}
      {tab === "list" && (
        <>
          {msg && (
            <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"}`}>
              {msg.text}
            </div>
          )}

          {/* Bulk update */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium mb-3">Massupdatering marginal</h2>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Varumärke (valfritt)</label>
                <select value={bulkBrand} onChange={(e) => setBulkBrand(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info">
                  <option value="">Alla varumärken</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Kategori (valfritt)</label>
                <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info">
                  <option value="">Alla kategorier</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Ny marginal (%)</label>
                <input type="number" value={bulkMargin} onChange={(e) => setBulkMargin(e.target.value)}
                  placeholder="30"
                  className="w-24 text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info" />
              </div>
              <button onClick={bulkUpdate} disabled={bulking || !bulkMargin}
                className="text-xs px-4 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition">
                {bulking ? "Uppdaterar…" : "Uppdatera"}
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök SKU eller namn…"
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info w-48" />
            <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-info">
              <option value="">Alla varumärken</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-info">
              <option value="">Alla kategorier</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-primary text-primary-foreground z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium">SKU</th>
                    <th className="text-left px-4 py-3 text-xs font-medium">Produkt</th>
                    <th className="text-left px-4 py-3 text-xs font-medium">Varumärke</th>
                    <th className="text-right px-4 py-3 text-xs font-medium">Inköpspris (kr)</th>
                    <th className="text-right px-4 py-3 text-xs font-medium">Marginal (%)</th>
                    <th className="text-right px-4 py-3 text-xs font-medium">Säljpris</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Laddar…</td></tr>
                  )}
                  {!loading && filtered.map((r) => {
                    const isDirty = edited[r.id] !== undefined;
                    return (
                      <tr key={r.id} className={`transition ${isDirty ? "bg-info/5" : "hover:bg-surface-alt/40"}`}>
                        <td className="px-4 py-2 tabular text-[11px] text-muted-foreground">{r.sku}</td>
                        <td className="px-4 py-2 max-w-[180px] truncate font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{r.brand.name}</td>
                        <td className="px-4 py-2">
                          <input type="number" value={getVal(r.id, "pp", r.purchase_price)}
                            onChange={(e) => setVal(r.id, "pp", e.target.value)} placeholder="—"
                            className="w-24 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={getVal(r.id, "margin", r.margin)}
                            onChange={(e) => setVal(r.id, "margin", e.target.value)} placeholder="20"
                            title={misstankMarginal(getVal(r.id, "margin", r.margin)) ? "Marginalen är i procent: 0,35 betyder 0,35 %, inte 35 %." : undefined}
                            className={`w-20 text-right text-xs rounded border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info ${misstankMarginal(getVal(r.id, "margin", r.margin)) ? "border-destructive" : "border-border"}`} />
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-mono font-medium text-foreground/80">
                          {sellPrice(
                            edited[r.id]?.pp !== undefined ? Number(edited[r.id].pp) : r.purchase_price,
                            edited[r.id]?.margin !== undefined ? edited[r.id].margin : r.margin,
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => saveRow(r.id)} disabled={saving === r.id || !isDirty}
                            className="text-xs px-2.5 py-1 rounded border border-border hover:border-info hover:text-info disabled:opacity-30 transition">
                            {saving === r.id ? "…" : "Spara"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: Prisintag (AI) ─────────────────────────────────────────────── */}
      {tab === "intake" && (
        <div className="space-y-6">

          {/* Instructions */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-1">Hur det fungerar</h2>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Ladda upp leverantörens <strong>prislista som Excel (.xlsx) eller CSV</strong> – snabbast för hela sortimentet. Raderna matchas på vårt artikelnummer, tillverkarens (t.ex. &quot;Mfr. Part No.&quot;) eller leverantörens eget. Klistra annars in en offert eller ladda upp en PDF och klicka <strong className="text-foreground">Analysera</strong>.</li>
              <li>Välj leverantör om priserna ska sparas hos den också (styr vem inköpsordern går till). Priser i EUR, USD eller GBP räknas om med Riksbankens kurs.</li>
              <li>Granska resultaten, justera marginal per rad, avmarkera felaktiga matchningar.</li>
              <li>Klicka <strong className="text-foreground">Bekräfta valda</strong> för att spara priserna.</li>
            </ol>
          </div>

          {/* Input area */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-medium">Offert / mejl / prislista</label>
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info disabled:opacity-50 transition"
                >
                  {pdfLoading ? (
                    <span className="animate-pulse">Läser PDF…</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Ladda upp PDF
                    </>
                  )}
                </button>
                <input ref={csvRef} type="file" accept=".xlsx,.xlsm,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleCsvUpload} />
                <button
                  onClick={() => csvRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M12 4v16" />
                  </svg>
                  Ladda upp prislista
                </button>
                <button
                  onClick={downloadTemplate}
                  title="Ladda ner alla artiklar som CSV — fyll i inköpspris och ladda upp igen"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Ladda ner mall
                </button>
                <button
                  onClick={() => { setInputText(""); setProposals([]); setIntakeMsg(null); }}
                  disabled={!inputText}
                  className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive disabled:opacity-30 transition"
                >
                  Rensa
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground">Leverantör (valfritt)</span>
                <select
                  value={levId}
                  onChange={(e) => setLevId(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[200px]"
                >
                  <option value="">Ingen – spara bara inköpspriset</option>
                  {leverantorer.map((l) => <option key={l.id} value={l.id}>{l.name}{l.is_active ? "" : " (ej aktiv)"}</option>)}
                </select>
              </label>
              {Object.entries(kurser).filter(([v]) => proposals.some((p) => p.valuta === v)).map(([v, k]) => (
                <label key={v} className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Kurs {v} (kr per {v}){k.datum ? `, Riksbanken ${k.datum}` : ""}</span>
                  <input
                    value={k.kurs}
                    onChange={(e) => setKurser((x) => ({ ...x, [v]: { ...x[v], kurs: e.target.value } }))}
                    inputMode="decimal"
                    className="w-28 rounded-md border border-border bg-background px-2 py-1.5 font-mono"
                  />
                  {k.fel && <span className="text-destructive">{k.fel}</span>}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Saknas leverantören? Lägg till den under <a href="leverantorer" className="underline">Leverantörer</a> först.
            </p>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Klistra in text här, t.ex:

Parker Hannifin AB – Offert 2024-06-01
P1D-S063MS-0200    Ø63 200mm ISO 15552      2 385 kr
P1D-S080MS-0200    Ø80 200mm ISO 15552      3 120 kr
...`}
              rows={10}
              className="w-full text-xs font-mono rounded-md border border-border bg-background px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-info placeholder:text-muted-foreground/50"
            />

            <div className="flex justify-end">
              <button
                onClick={analyze}
                disabled={analyzing || !inputText.trim()}
                className="px-5 py-2 text-sm font-medium rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
              >
                {analyzing && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {analyzing ? "Analyserar…" : "Analysera"}
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {intakeMsg && (
            <div className={`px-4 py-2 rounded-md text-sm ${intakeMsg.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"}`}>
              {intakeMsg.text}
            </div>
          )}

          {/* Rader som inte kan sparas */}
          {ejSparbara.length > 0 && (
            <details className="rounded-xl border border-border bg-card p-4 text-xs">
              <summary className="cursor-pointer text-sm font-medium">
                {ejSparbara.length} rader kan inte sparas
                <span className="ml-2 font-normal text-muted-foreground">
                  ({Object.entries(sammanfatta(ejSparbara)).filter(([, n]) => n > 0).map(([st, n]) => `${STATUSTEXT[st as Status].toLowerCase()} ${n}`).join(", ")})
                </span>
              </summary>
              <div className="mt-3 flex justify-end">
                <button onClick={laddaNerEjSparbara} className="px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info transition">
                  Ladda ner som CSV
                </button>
              </div>
              <div className="mt-2 max-h-72 overflow-auto">
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left py-1 pr-3">Rad</th><th className="text-left py-1 pr-3">Nummer</th><th className="text-left py-1 pr-3">Benämning</th><th className="text-left py-1 pr-3">Varför</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ejSparbara.slice(0, 300).map((r) => (
                      <tr key={r.rad}>
                        <td className="py-1 pr-3 text-muted-foreground">{r.rad}</td>
                        <td className="py-1 pr-3 font-mono">{r.kod}{r.levKod && r.levKod !== r.kod ? ` (${r.levKod})` : ""}</td>
                        <td className="py-1 pr-3 max-w-[260px] truncate">{r.namn}</td>
                        <td className="py-1 pr-3">{STATUSTEXT[r.status]}{r.anm.length ? ` – ${r.anm.join("; ")}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Proposals table */}
          {proposals.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {selectedCount} av {proposals.length} markerade
                  </span>
                  <button
                    onClick={() => setProposals((p) => p.map((r) => ({ ...r, selected: true })))}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Markera alla
                  </button>
                  <button
                    onClick={() => setProposals((p) => p.map((r) => ({ ...r, selected: false })))}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Avmarkera alla
                  </button>
                </div>
                <button
                  onClick={confirmSelected}
                  disabled={saving2 || selectedCount === 0}
                  className="px-4 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {saving2 && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  {saving2 ? "Sparar…" : `Bekräfta ${selectedCount} pris${selectedCount !== 1 ? "er" : ""}`}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 w-8" />
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Produkt</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Varumärke</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Inköpspris</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Matchning</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Marginal (%)</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Säljpris</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {proposals.map((p, i) => { const kr = iKronor(p.prisOriginal, p.valuta, kursFor(p.valuta)); return (
                      <tr
                        key={`${p.sku}-${i}`}
                        className={`transition ${p.selected ? "bg-card" : "opacity-40 bg-muted/20"}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={p.selected}
                            onChange={(e) => setProposals((prev) =>
                              prev.map((r, j) => j === i ? { ...r, selected: e.target.checked } : r)
                            )}
                            className="rounded border-border accent-info cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {p.sku}
                        </td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <div className="truncate text-xs font-medium">{p.name}</div>
                          {p.evidence && (
                            <div className="truncate text-[10px] text-muted-foreground/70 mt-0.5 italic">
                              „{p.evidence.slice(0, 60)}{p.evidence.length > 60 ? "…" : ""}"
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{p.brand}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-mono text-xs font-medium">
                            {kr != null ? `${kr.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr` : "ange kurs"}
                          </span>
                          {p.valuta !== "SEK" && (
                            <div className="text-[10px] text-muted-foreground/70">{p.prisOriginal.toLocaleString("sv-SE", { maximumFractionDigits: 4 })} {p.valuta}</div>
                          )}
                          {p.currency_note && (
                            <div className="text-[10px] text-muted-foreground/60">{p.currency_note}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {p.status === "match" ? confidenceBadge(p.confidence) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              {STATUSTEXT[p.status]}
                            </span>
                          )}
                          {(p.anm.length > 0 || p.via) && (
                            <div className="text-[10px] text-muted-foreground/70 mt-0.5 max-w-[220px] mx-auto">{[...p.anm, p.via].filter(Boolean).join("; ")}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            value={p.margin}
                            onChange={(e) => setProposals((prev) =>
                              prev.map((r, j) => j === i ? { ...r, margin: e.target.value } : r)
                            )}
                            className="w-16 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                          {sellPrice(kr, p.margin)}
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
