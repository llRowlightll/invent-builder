-- knowledge_chunks: 2 442 dubblettrader bort, unik nyckel på (source_file, chunk_index).
--
-- Tabellen hade ingen unik nyckel, och scripts/ingest-catalogues.py gör en ren
-- insert. En fil som lästes in två gånger fick därför varje stycke två gånger,
-- tyst: 54 av 181 filer, 2 442 extrarader av 32 236. Rådgivaren läser tabellen
-- via search_knowledge, så en dubblettfil vägde dubbelt i träfflistan och kunde
-- tränga ut ett annat dokuments stycke ur de fem som får plats i promptet.
--
-- 2 441 av 2 442 nyckelpar har IDENTISKT innehåll. Det enda undantaget är
-- 0600P_Index.pdf stycke 2 (Parkers copyrightsida), där de två inläsningarna
-- skiljer sig på raka vs typografiska citattecken -- samma text, samma längd.
-- Regeln nedan är därför enkel och enhetlig: behåll den äldsta raden per
-- (source_file, chunk_index), med id som tiebreak.
--
-- Raderna sparas i backup.knowledge_chunks_dubbletter_20260922 innan de tas
-- bort. Inga embeddings går förlorade: kolumnen är tom i hela tabellen (0 av
-- 32 236 rader) -- sökningen är tsv-baserad.

begin;

create schema if not exists backup;

create table if not exists backup.knowledge_chunks_dubbletter_20260922 as
with rankad as (
  select id, source_file, chunk_index, brand, product_family, content, created_at,
         row_number() over (partition by source_file, chunk_index
                            order by created_at, id) as rn
  from knowledge_chunks
)
select id, source_file, chunk_index, brand, product_family, content, created_at
from rankad where rn > 1;

delete from knowledge_chunks k
using backup.knowledge_chunks_dubbletter_20260922 b
where k.id = b.id;

-- Gör om inläsningen till en idempotent operation. Utan den här kunde samma
-- fil läsas in igen utan att något sa ifrån; nu krockar den i stället, och
-- ingest-scriptet skriver "on conflict (source_file, chunk_index) do nothing".
create unique index if not exists knowledge_chunks_source_chunk_uniq
  on knowledge_chunks (source_file, chunk_index);

commit;
