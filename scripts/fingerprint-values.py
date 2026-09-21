#!/usr/bin/env python3
"""
Fingeravtryck för värdelistan och schema_json i en genererad familjemigration,
att jämföra med databasen efter apply_migration.

Kör:  python3 scripts/fingerprint-values.py supabase/migrations/<fil>.sql

Motsvarande SQL:
  select count(*), md5(string_agg(h, '' order by h))
  from (select md5(p.param_key||'|'||v.code||'|'||v.label) h
        from configurator_param_values v
        join configurator_params p on p.id = v.param_id
        join configurator_families f on f.id = p.family_id
        where f.slug = '<slug>') x;
  select md5(schema_json::text) from config_schemas where schema_id = '<SCHEMA>';

schema_json hashas i Postgres jsonb-form: nycklar sorterade efter längd och
därefter byte för byte, ", " och ": " som avskiljare, arrayer i given ordning.
Rader hashas var för sig och de sorterade hexsummorna hashas ihop, så
ordningen spelar ingen roll (samma som scripts/fingerprint-rules.ts).
"""
import hashlib
import json
import re
import sys


def pg(v):
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, list):
        return "[" + ", ".join(pg(x) for x in v) + "]"
    if isinstance(v, dict):
        ks = sorted(v.keys(), key=lambda k: (len(k.encode()), k.encode()))
        return "{" + ", ".join(json.dumps(k, ensure_ascii=False) + ": " + pg(v[k]) for k in ks) + "}"
    return json.dumps(v, ensure_ascii=False)


def main(path):
    s = open(path, encoding="utf-8").read()
    for m in re.finditer(r"insert into configurator_param_values.*?jsonb_to_recordset\('(\[.*?\])'::jsonb\).*?f\.slug = '([^']+)'", s, re.S):
        vals = json.loads(m.group(1).replace("''", "'"))
        hs = sorted(hashlib.md5((r["param_key"] + "|" + r["code"] + "|" + r["label"]).encode()).hexdigest() for r in vals)
        print("värden", m.group(2), len(vals), hashlib.md5("".join(hs).encode()).hexdigest())
    for m in re.finditer(r"insert into config_schemas \(schema_id, schema_json.*?\nvalues \('([^']+)', '(\{.*?\})'::jsonb", s, re.S):
        schema = json.loads(m.group(2).replace("''", "'"))
        print("schema", m.group(1), hashlib.md5(pg(schema).encode()).hexdigest())


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
