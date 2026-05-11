# Upgrade to Public MVP + Master-Family Configurator

## Summary
Pivot LifeMap from a login-gated tool into a public, adoption-focused MVP with locale-aware chat, a use-case-driven Components catalog, a generic schema-driven Configurator engine, and a "Talk to engineer" inquiry flow. Reuse existing tables/code where possible; add what's missing.

## Scope

### 1. Public access (no login required)
- Make `/project`, `/components`, `/compare`, `/talk` public.
- Login stays optional; only saving BOMs/RFQs requires it.
- Update `__root.tsx` / `$locale.tsx` header nav to: Project · Components · Compare · Talk to engineer · (Login).

### 2. i18n & locale-aware chat
- Already have `/en` `/sv` routing — verify root redirect uses cookie → profile → browser.
- Pass `locale` into AI prompts in `ai.functions.ts`; force "respond only in Swedish" / "only in English".

### 3. New pages (under `/$locale/`)
- `project.tsx` — guided chat (rebuild of existing `chat.tsx`, returns Best + Cheapest BOM + WHY + Configure button).
- `components.tsx` — category tiles → use-case tiles → 3–5 recommended families.
- `talk.tsx` — AI vs Human tabs; human submits to `inquiries`.
- `configurator.$schemaId.tsx` — generic schema-driven runner (replaces hard-coded `configurator.tsx`).
- Keep `compare`, `product/$sku`, `admin/import`, `settings`.

### 4. Database additions (migration)
New tables:
- `use_case_map` (category_slug, use_case_slug, title_en, title_sv, recommended_skus[])
- `config_schemas` (schema_id, title_en, title_sv, schema_json)
- `config_rules` (schema_id, severity, if_json, message_en, message_sv, goto_step)
- `config_bom_mapping` (schema_id, bom_mapping_json)
- `inquiries` (name, email, message, locale, created_at) — public insert
- `rfq_requests` (alias/extend existing `rfqs` — keep existing)

Reuse existing: `products`, `product_specs`, `product_relations`, `competitor_map`, `boms`, `bom_items`, `rfqs`.

RLS: public read on catalog/use-case/schema tables; public insert on `inquiries`; authenticated owner on boms/rfqs.

### 5. Configurator engine
- `src/lib/configurator-engine.ts`: load schema, render stepper, evaluate `if_json` rules (simple JSON-logic: `{"<": [{"var": "stroke_mm"}, 50]}`), produce messages, generate order code, build BOM from `bom_mapping_json` + `product_relations` spares.
- Block RFQ submit on `error` severity; allow `warn`.
- CSV export.

### 6. Components page UX
- Category tiles → query `use_case_map` for that category → use-case tiles → list 3–5 SKUs from `recommended_skus[]`.
- Each card: "what it does", Configure button (if family has `config_schemas` row), Add-ons/Spares chips (from `product_relations`), Request custom solution.

### 7. Project chat
- 2–5 deterministic follow-ups based on category (rules in `src/lib/followups.ts`).
- Returns Best + Cheapest BOMs (existing `selection.ts`) + 2 alternatives + spares + WHY template.
- Locale-aware. AI optional via existing Lovable AI Gateway.

### 8. Talk to engineer
- Tabs: AI (reuses chat) / Human (form → `inquiries` insert, public).

### 9. Admin import
- Extend existing `admin.import.tsx` to accept CSV for `use_case_map` and JSON for `config_schemas`, `config_rules`, `config_bom_mapping`.

### 10. Seed data
- Seed `use_case_map` (a few entries per category) and one `config_schemas` row for `EA-LINEAR-AXIS` mapped to existing selection logic, plus a few rules.

## Out of scope
- Real ordering/EDI, payments, 3D viewer overhaul (keep current viewer), price data.

## Technical notes
- Migration runs first (one call), then code follows.
- Header nav refactored in `src/routes/$locale.tsx`.
- Old `chat.tsx`, `configurator.tsx`, `wizard.tsx`, `convert.tsx` → keep as redirects or remove from nav; reuse logic in `project.tsx` and `configurator.$schemaId.tsx`.
- All translation keys added to `en.json` / `sv.json`.
- AI prompts get `Respond ONLY in ${locale === "sv" ? "Swedish" : "English"}.` system instruction.

## Files to create
- `supabase/migrations/<ts>_master_family.sql`
- `src/routes/$locale/project.tsx`
- `src/routes/$locale/components.tsx`
- `src/routes/$locale/talk.tsx`
- `src/routes/$locale/configurator.$schemaId.tsx`
- `src/lib/configurator-engine.ts`
- `src/lib/followups.ts`

## Files to edit
- `src/routes/$locale.tsx` (nav)
- `src/routes/$locale/app.tsx` (or remove auth gate)
- `src/lib/ai.functions.ts` (locale param)
- `src/routes/$locale/admin.import.tsx` (new importers)
- `src/locales/en.json`, `sv.json`
- `src/routes/$locale/index.tsx` (public CTAs)

Ready to implement on approval.
