/**
 * SIE 4 export — the Swedish standard accounting interchange format.
 *
 * Produces a file that imports directly into Fortnox, Visma, Bokio etc. as
 * journal entries (verifikationer). Each sale and expense becomes a balanced
 * double-entry verification on standard BAS accounts. No dependency: SIE is a
 * line-based text format, encoded as IBM PC8 (CP437) per the standard.
 *
 * buildSie() returns the encoded bytes (pure — testable); downloadSie() saves.
 */

export type SieSale = { date: string; ref: string; customer: string; ex: number; vat: number };
export type SieExpense = {
  date: string;
  description: string;
  supplier?: string | null;
  ex: number;
  vat: number;
};
export type SieOpts = {
  companyName?: string;
  sales: SieSale[];
  expenses: SieExpense[];
  generatedAt?: Date;
};

// BAS-konton som verifikationerna bokförs på.
const ACCOUNTS: [number, string][] = [
  [1510, "Kundfordringar"],
  [2440, "Leverantörsskulder"],
  [2611, "Utgående moms, 25 %"],
  [2640, "Ingående moms"],
  [3001, "Försäljning inom Sverige, 25 % moms"],
  [6990, "Övriga externa kostnader"],
];

// CP437 (PC8) — map the non-ASCII characters we realistically encounter in
// Swedish/Nordic names; anything else degrades to '?'.
const CP437: Record<string, number> = {
  "Ç": 128, "ü": 129, "é": 130, "â": 131, "ä": 132, "à": 133, "å": 134, "ç": 135,
  "ê": 136, "ë": 137, "è": 138, "ï": 139, "î": 140, "ì": 141, "Ä": 142, "Å": 143,
  "É": 144, "æ": 145, "Æ": 146, "ô": 147, "ö": 148, "ò": 149, "û": 150, "ù": 151,
  "ÿ": 152, "Ö": 153, "Ü": 154, "ø": 155, "Ø": 157, "á": 160, "í": 161, "ó": 162,
  "ú": 163, "ñ": 164, "Ñ": 165, "ß": 225, "µ": 230,
};
function toCp437(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code < 128) out.push(code);
    else if (CP437[ch] != null) out.push(CP437[ch]);
    else out.push(0x3f); // '?'
  }
  return new Uint8Array(out);
}

const ymd = (d: string) => d.slice(0, 10).replace(/-/g, "");
const q = (s: string) => '"' + (s || "").replace(/"/g, "'").replace(/\s+/g, " ").trim() + '"';
const amt = (n: number) => n.toFixed(2);

export function buildSie(opts: SieOpts): Uint8Array {
  const gen = opts.generatedAt ?? new Date();
  const genYmd = gen.toISOString().slice(0, 10).replace(/-/g, "");
  const L: string[] = [];

  L.push("#FLAGGA 0");
  L.push('#PROGRAM "Maskinval webshop" 1.0');
  L.push("#FORMAT PC8");
  L.push(`#GEN ${genYmd}`);
  L.push("#SIETYP 4");
  L.push(`#FNAMN ${q(opts.companyName ?? "Maskinval")}`);

  // Räkenskapsår — declare every calendar year present so all verifications
  // fall inside a known period (0 = latest, -1 = previous, …).
  const years = new Set<number>();
  for (const s of opts.sales) years.add(Number(s.date.slice(0, 4)));
  for (const e of opts.expenses) years.add(Number(e.date.slice(0, 4)));
  [...years]
    .filter(Boolean)
    .sort((a, b) => b - a)
    .forEach((yr, i) => L.push(`#RAR ${-i} ${yr}0101 ${yr}1231`));

  for (const [n, name] of ACCOUNTS) L.push(`#KONTO ${n} ${q(name)}`);

  // Försäljning (serie F): kundfordran debet, försäljning + utgående moms kredit.
  let f = 1;
  for (const s of opts.sales) {
    const inc = s.ex + s.vat;
    L.push(`#VER F ${f++} ${ymd(s.date)} ${q(`${s.ref} ${s.customer}`)}`);
    L.push("{");
    L.push(`   #TRANS 1510 {} ${amt(inc)}`);
    L.push(`   #TRANS 3001 {} ${amt(-s.ex)}`);
    L.push(`   #TRANS 2611 {} ${amt(-s.vat)}`);
    L.push("}");
  }

  // Utgifter (serie U): kostnad + ingående moms debet, leverantörsskuld kredit.
  let u = 1;
  for (const e of opts.expenses) {
    const inc = e.ex + e.vat;
    const text = `Utgift: ${e.description}${e.supplier ? ` (${e.supplier})` : ""}`;
    L.push(`#VER U ${u++} ${ymd(e.date)} ${q(text)}`);
    L.push("{");
    L.push(`   #TRANS 6990 {} ${amt(e.ex)}`);
    L.push(`   #TRANS 2640 {} ${amt(e.vat)}`);
    L.push(`   #TRANS 2440 {} ${amt(-inc)}`);
    L.push("}");
  }

  return toCp437(L.join("\r\n") + "\r\n");
}

export function downloadSie(filename: string, data: Uint8Array): void {
  // Copy into a fresh ArrayBuffer so the Blob gets a clean BlobPart.
  const url = URL.createObjectURL(new Blob([data.slice()] as BlobPart[], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
