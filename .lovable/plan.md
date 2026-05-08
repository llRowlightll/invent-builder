## LifeMap Industrial — Build Plan

This is a large, multi-system MVP. I'll build it in phases against your acceptance criteria. Confirming the plan before I start so we don't burn cycles on the wrong direction.

### Stack decisions (locked from your spec)
- TanStack Start (this template) — not Next.js. All your routes will work the same with file-based routing under `src/routes/{locale}/...`.
- Lovable Cloud (Supabase under the hood) for DB + auth + storage + server functions.
- Lovable AI Gateway for Gemini (free tier: `google/gemini-3-flash-preview` for FAST, `google/gemini-2.5-pro` for ASSIST). No API key needed from you — works out of the box on the free included usage. Fallback (keyword extraction + templated explanations) still implemented for when credits run out.
- react-three-fiber + drei for 3D viewer.
- i18n via JSON dictionaries + URL prefix `/en` and `/sv`.

### Phase 1 — Foundations
1. Enable Lovable Cloud.
2. i18n: `/locales/en.json`, `/locales/sv.json`, locale provider, `/` redirect (cookie → profile → browser lang), `<html lang>` + hreflang, language switcher.
3. App shell, design tokens (light premium B2B palette, gold #C9A75D / blue #7AA7FF accents) in `src/styles.css`.
4. Auth (email signup/login) + `users_profile` with locale.

### Phase 2 — Database + seed
5. Migrations for all 13 tables (users_profile, dataset_versions, products_core, product_specs, competitor_groups, product_relations, solution_templates, mappings_pneu_to_ea, boms, bom_items, rfq_requests, ai_usage_logs, config_sessions) with RLS.
6. Seed `seed_v1` dataset: ≥30 products, ≥80 specs, ≥25 relations, ≥6 competitor groups, 2 solution templates, 1 pneu→EA mapping ruleset (Festo/SMC actuators, Siemens drives/PSU/PLC/IO, sensors, pneumatics, accessories).

### Phase 3 — Core selection engine
7. Deterministic selection engine (server fn): actuator → drive → PSU → PLC/IO → feedback → cables → spares, with BEST vs CHEAPEST scoring (cost proxy: availability + lead time + part count + feedback complexity vs margin + IP + robustness).
8. Validation engine (errors + warnings) returning structured rule triggers.

### Phase 4 — Configurator A (`/configurator/ea-axis-bundle`)
9. Stepper (Basic → Motion → Control → Accessories → Overview), live order code `AX-{mode}-{stroke}-{force}-{feedback}-{fieldbus}-{voltage}-{ip}`, Messages/Links/CAD right panel, RFQ gated on errors, persists `config_sessions` + generates `boms`/`bom_items`.

### Phase 5 — Chat, Wizard, Conversion
10. `/chat` — Ask the Engineer: AI extract → followups → BEST + CHEAPEST + 2 alts + comparison + BOM preview + actions.
11. `/wizard` — guided form variant of chat.
12. `/convert` — pneumatic inputs → force calc `P·π·(d/2)²` + margin → reuse selection engine → EA bundle.

### Phase 6 — Catalog, Compare, BOM, RFQ
13. `/products`, `/product/{sku}`, `/compare` (2–3 side by side).
14. `/bom/{bomId}` with CSV export + printable view.
15. `/rfq/{rfqId}` + `/orders` list. RFQ creation, CSV export, printable summary, `/api/public/notify/rfq` webhook stub that logs payload, "Copy email text" button.

### Phase 7 — 3D viewer
16. r3f viewer on product + BOM pages, 2 placeholder GLBs, mesh-name → BOM item highlighting, fallback procedural block diagram when no model matches.

### Phase 8 — AI (Lovable AI Gateway, free Gemini)
17. Server fns: `extractRequirements` (FAST/gemini-3-flash-preview), `explain` (ASSIST/gemini-2.5-pro), `explainValidation` (ASSIST). 24h hash cache in `ai_usage_logs`, per-user rate limit, token cap, only top candidates sent. Keyword + template fallback when 402/429/no key.

### Phase 9 — Admin import + Settings
18. `/admin/import` — CSV/JSON upload for products/specs/relations/groups/templates/schemas, validation, failed-row report, dataset version create, activate/rollback (single active).
19. `/settings` — language, AI mode, export profile data, delete profile.

### Phase 10 — Acceptance pass
20. Walk all 10 acceptance criteria; fix gaps.

### Notes / reasonable choices I'll make
- "PDF optional" → CSV + printable HTML page (browser print-to-PDF). No PDF lib.
- Email notification = webhook stub + copy-to-clipboard email body (no SMTP).
- 3D placeholder GLBs: use 2 simple ones (extruded box "actuator", cube "drive cabinet") generated at build or shipped under `public/models/`.
- RFQ "send" only logs to webhook + DB; no real outbound mail.
- Currency/price hidden everywhere — RFQ-only.

### Scale warning
This is roughly 60–100 files and several hours of generation. I'll work in the phase order above and check in if I hit ambiguity. Reply **"go"** to start, or tell me which phases to drop / reorder.
