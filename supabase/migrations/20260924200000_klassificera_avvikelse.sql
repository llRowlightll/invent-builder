-- Klassningen: grön, gul eller röd.
--
-- En ren funktion. Den läser ingenting och skriver ingenting -- den jämför vad
-- vi beställde med vad leverantören svarade och säger vad det betyder. Därför
-- går den att prova med tabellvärden, och därför kan både den manuella
-- registreringen i dag och e-posttolkningen i FAS 2 använda exakt samma regler.
--
-- ORDNINGEN ÄR PRIORITERAD: en rad kan ha flera avvikelser samtidigt (fel
-- antal OCH försenad OCH dyrare), alla skäl samlas, och den värsta nivån
-- vinner. En röd rad blir inte gul för att den också råkar ha en gul avvikelse.
--
-- TVÅ AVGÖRANDEN VÄRDA ATT SÄGA HÖGT:
--
-- 1. TIDIGARE leverans än önskat är GRÖNT, inte gult. Leverantören gjorde oss
--    en tjänst; att larma på det lär administratören att ignorera larm.
--
-- 2. PRIS SOM VI INTE KÄNDE blir GULT, inte rött. I dag saknar alla 846
--    produkter inköpspris, så leverantörens pris är första gången vi ser det.
--    Det är ny information, inte en prisändring -- rött hade stoppat varenda
--    rad och gjort klassningen meningslös.

begin;

create or replace function klassificera_avvikelse(
  p_bestallt_antal        numeric,
  p_bestallt_pris         numeric,
  p_onskad_leverans       date,
  p_bekraftat_antal       numeric,
  p_bekraftat_pris        numeric,
  p_bekraftad_leverans    date,
  p_svar                  text,
  p_ersattning            text,
  p_pristolerans_pct      numeric default 0,
  p_forsinkningstolerans  int default 0
)
returns table(niva text, skal text)
language plpgsql
immutable
as $$
declare
  v_skal      text[] := '{}';
  v_niva      text := 'gron';
  v_svar      text := lower(coalesce(nullif(btrim(p_svar), ''), 'accepted'));
  v_pristol   numeric := coalesce(p_pristolerans_pct, 0);
  v_dagtol    int     := coalesce(p_forsinkningstolerans, 0);
  v_diff_pct  numeric;
  v_dagar     int;

begin
  -- Nivån höjs för hand och sänks aldrig: en röd rad blir inte gul för att
  -- den också råkar ha en gul avvikelse.
  if v_svar in ('rejected', 'declined') then
    v_niva := 'rod'; v_skal := v_skal || 'leverantören avvisade raden'::text;
  elsif v_svar = 'discontinued' then
    v_niva := 'rod'; v_skal := v_skal || 'produkten är utgången'::text;
  elsif v_svar = 'backordered' then
    v_niva := 'rod'; v_skal := v_skal || 'restnoterad'::text;
  elsif v_svar = 'question' then
    v_niva := 'rod'; v_skal := v_skal || 'leverantören har en fråga som måste besvaras'::text;
  end if;

  if nullif(btrim(coalesce(p_ersattning, '')), '') is not null or v_svar = 'substituted' then
    v_niva := 'rod';
    -- Explicit ::text: utan den kan Postgres inte avgöra om högersidan är
    -- ett element eller en array, och kastar "malformed array literal".
    v_skal := v_skal || ('ersättningsprodukt föreslagen' ||
                         coalesce(': ' || nullif(btrim(p_ersattning), ''), ''))::text;
  end if;

  -- Antal: varje avvikelse är röd. "Vi skickar tre av fem" är inte en
  -- detalj -- det är en annan order än den vi lade.
  if p_bekraftat_antal is not null and p_bestallt_antal is not null
     and p_bekraftat_antal <> p_bestallt_antal then
    v_niva := 'rod';
    -- trim_scale, inte trim(trailing '.0'): det senare tar bort tecken ur
    -- MÄNGDEN {'.','0'}, så "10" blev "1".
    v_skal := v_skal || format('bekräftat antal %s mot beställt %s',
                               trim_scale(p_bekraftat_antal), trim_scale(p_bestallt_antal));
  end if;

  -- Pris.
  if p_bekraftat_pris is not null then
    if p_bestallt_pris is null or p_bestallt_pris = 0 then
      if v_niva = 'gron' then v_niva := 'gul'; end if;
      v_skal := v_skal || format('priset var okänt hos oss; leverantören anger %s', trim_scale(p_bekraftat_pris));
    elsif p_bekraftat_pris <> p_bestallt_pris then
      v_diff_pct := round(abs(p_bekraftat_pris - p_bestallt_pris) / p_bestallt_pris * 100, 2);
      if v_diff_pct > v_pristol then
        v_niva := 'rod';
        v_skal := v_skal || format('pris %s mot %s (%s %%, tolerans %s %%)',
                                   trim_scale(p_bekraftat_pris), trim_scale(p_bestallt_pris), v_diff_pct, v_pristol);
      else
        if v_niva = 'gron' then v_niva := 'gul'; end if;
        v_skal := v_skal || format('pris %s mot %s (%s %%, inom tolerans)',
                                   trim_scale(p_bekraftat_pris), trim_scale(p_bestallt_pris), v_diff_pct);
      end if;
    end if;
  end if;

  -- Leveransdatum. Tidigare än önskat är ingen avvikelse.
  if p_bekraftad_leverans is not null and p_onskad_leverans is not null then
    v_dagar := p_bekraftad_leverans - p_onskad_leverans;
    if v_dagar > v_dagtol then
      v_niva := 'rod';
      v_skal := v_skal || format('leverans %s dagar senare än önskat (tolerans %s)', v_dagar, v_dagtol);
    elsif v_dagar > 0 then
      if v_niva = 'gron' then v_niva := 'gul'; end if;
      v_skal := v_skal || format('leverans %s dagar senare än önskat (inom tolerans)', v_dagar);
    end if;
  end if;

  niva := v_niva;
  skal := case when cardinality(v_skal) = 0 then 'bekräftad utan avvikelse'
               else array_to_string(v_skal, '; ') end;
  return next;
end $$;

comment on function klassificera_avvikelse is
  'Jämför en bekräftad rad med den beställda och returnerar gron/gul/rod plus skälen. Ren: läser och skriver ingenting.';

commit;
