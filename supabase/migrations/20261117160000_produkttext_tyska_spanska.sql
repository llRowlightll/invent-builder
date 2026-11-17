-- Tyska och spanska produktbeskrivningar (2026-11-17). Översatta från
-- description_en med en fast ordlista, så att tekniska termer blir rätt
-- (stroke -> Hub / carrera, bore -> Kolbendurchmesser / diámetro).
-- Null betyder att engelskan visas, som förut.
alter table public.products add column if not exists description_de text, add column if not exists description_es text;
comment on column public.products.description_de is 'Tysk beskrivning, översatt från description_en med fast ordlista (2026-11-17). Null = visa engelskan.';
comment on column public.products.description_es is 'Spansk beskrivning, översatt från description_en med fast ordlista (2026-11-17). Null = visa engelskan.';
