/**
 * Textparameter i adressfältet.
 *
 * TanStack Router tolkar sökparametrar som JSON när det går: ?q=153305 blir
 * talet 153305 och ?borr=50 talet 50. Med z.string() gav det serverfel 500
 * ("Expected string, received number") för alla numeriska artikelnummer --
 * hittat av en kundgranskning 2026-11-12 (/sv/products?q=153305,
 * /sv/replace?kod=1376659). Tal och sanningsvärden blir här text igen.
 *
 * Obs: z.coerce.string() fungerar inte, den gör undefined till "undefined".
 */
import { z } from "zod";

export function somText(v: unknown): unknown {
  return typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" ? String(v) : v;
}

export const textParam = () => z.preprocess(somText, z.string().optional());
