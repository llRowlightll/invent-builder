-- Order Engine: prov av grunden (orders, order_items, suppliers) och av
-- kedjan inköpslista -> offert -> order.
--
-- Sju delar: 1-34 orders/order_items/leverantörer med RLS, 35-47 kundens egen
-- väg via respond_to_quote, 48-59 konfiguratorns orderkod hela vägen fram,
-- 60-72 grupperingen till inköpsordrar per leverantör, 73-78 en orderrad som
-- tillkommer efter att inköpsordrarna skapats, 79-94 klassningen grön/gul/röd,
-- 95-111 leverantörens bekräftelse hela vägen till kundens orderrad, 112-115
-- en inköpsorder där leverantören inte svarat på alla rader, 116-121 att
-- inköpsorderns avledda värden räknas om när raderna ändras, 122-125 en
-- leverantör vi inte aktiverat, 126-131 att offert och beställning hålls isär,
-- 132-145 checkoutens fält och att ordern fryser dem.
--
-- Kör i SQL-editorn eller via execute_sql. Skapar sin egen provdata och
-- STÄDAR UPP SIG SJÄLV, utan att förlita sig på en yttre rollback -- provet
-- ska ge samma svar oavsett klient. Två saker rör det utanför sin egen order,
-- och båda skrivs tillbaka i samma block: ett produktnamn (kontroll 15) och
-- Festos is_active-flagga (kontroll 125).
--
-- Provet finns för att kedjan består av delar som måste hålla IHOP:
-- en RPC som skriver atomiskt, en trigger som härleder orders.items ur
-- raderna, RLS på tre nivåer, snapshots som inte får röra sig när katalogen
-- ändras, och ett audit-spår. Var för sig är de lätta att få rätt; det är
-- samspelet som går sönder.
--
--   psql:  \i scripts/test-order-engine.sql
--
-- Utskriften är en rad per kontroll med OK eller FEL. Sista raden säger hur
-- många som föll.
--
-- TRE IDENTITETER, och skillnaden mellan dem är hela poängen med RLS-delen:
--
--   v_agare   en riktig användare ur auth.users (orders.user_id har en
--             främmande nyckel dit). Äger provordern.
--   v_utomst  ett påhittat uuid: en INLOGGAD användare utan admin-roll som
--             inte äger ordern. Behöver inte finnas i auth.users, eftersom
--             den bara läser. Det är den identiteten som visar att
--             inköpspriser och leverantörer är stängda för kundroller --
--             båda kontona i den här databasen är nämligen admin, så att
--             prova med dem hade gett falskt grönt.
--   anon      utloggad. Kräver att request.jwt.claims NOLLSTÄLLS: "reset
--             role" rör dem inte, så ett prov som glömmer det kör vidare
--             som föregående användare och ser för mycket.

drop table if exists prov_resultat;
create temporary table prov_resultat (nr int, kontroll text, forvantat text, faktiskt text, ok boolean);

-- SECURITY DEFINER: kontrollerna görs medan rollen är växlad till anon eller
-- authenticated för att prova RLS, och de rollerna får inte skriva i
-- temptabellen. Utan det här faller provet på sin egen resultatrapportering.
create or replace function pg_temp.kolla(p_nr int, p_kontroll text, p_forvantat text, p_faktiskt text)
returns void language sql security definer as $$
  insert into prov_resultat values (p_nr, p_kontroll, p_forvantat, p_faktiskt,
                                    p_forvantat is not distinct from p_faktiskt);
$$;

do $$
declare
  -- orders.user_id har en främmande nyckel mot auth.users, så ÄGAREN måste
  -- vara en riktig användare. Provordern lever i millisekunder och raderas i
  -- kontroll 23. "Den andre" behöver inte finnas: den används bara i
  -- jwt-anspråk och i ett anrop som ska avvisas innan något skrivs.
  v_agare  uuid := (select id from auth.users order by created_at limit 1);
  v_utomst uuid := '00000000-0000-0000-0000-00000000f002';
  v_order  uuid;
  v_smc    uuid := (select id from suppliers where slug = 'smc');
  v_festo  uuid := (select id from suppliers where slug = 'festo');
  v_txt    text;
  v_int    int;
  v_fel    text;
begin
  if v_agare is null then
    raise exception 'provet kräver minst en användare i auth.users';
  end if;

  -- ── 1. RPC:n vägrar utan inloggning ──────────────────────────────────────
  begin
    perform create_order_with_items('{}'::jsonb, '[]'::jsonb);
    v_fel := 'ingen';
  exception when others then v_fel := 'kastade';
  end;
  perform pg_temp.kolla(1, 'RPC vägrar utan inloggning', 'kastade', v_fel);

  -- Simulera en inloggad kund (ingen admin-roll).
  set local role authenticated;
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_agare), true);

  -- ── 2. RPC:n vägrar tom orderrad ─────────────────────────────────────────
  begin
    perform create_order_with_items(format('{"user_id":"%s"}', v_agare)::jsonb, '[]'::jsonb);
    v_fel := 'ingen';
  exception when others then v_fel := 'kastade';
  end;
  perform pg_temp.kolla(2, 'RPC vägrar order utan rader', 'kastade', v_fel);

  -- ── 3. RPC:n vägrar order åt någon annan ─────────────────────────────────
  begin
    perform create_order_with_items(
      format('{"user_id":"%s"}', v_utomst)::jsonb,
      '[{"sku":"X","name":"Y","qty":1,"unit_price_ex_vat":10}]'::jsonb);
    v_fel := 'ingen';
  exception when others then v_fel := 'kastade';
  end;
  perform pg_temp.kolla(3, 'RPC vägrar order åt annan användare', 'kastade', v_fel);

  -- ── 4. Ordern skapas med sina rader, atomiskt ────────────────────────────
  -- Scenariot ur acceptanskriterierna: tre rader, två leverantörer.
  v_order := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Provkund AB","customer_email":"k@example.com",
             "po_number":"PO-54872","currency":"SEK","vat_rate":0.25}', v_agare)::jsonb,
    '[{"sku":"SMC-KQ2H06-00A","name":"KQ2H06-00A rak skarv ø6","brand":"SMC","qty":10,"unit_price_ex_vat":42.50},
      {"sku":"FESTO-DSNU-32","name":"DSNU ø32","brand":"Festo","qty":2,"unit_price_ex_vat":1290},
      {"sku":"SPECIFY","name":"Kundanpassad fästplåt","qty":1,"unit_price_ex_vat":0}]'::jsonb);
  reset role;

  select count(*)::int into v_int from order_items where order_id = v_order;
  perform pg_temp.kolla(4, 'tre rader skapade', '3', v_int::text);

  -- ── 5. line_total räknas fram när den inte skickas med ───────────────────
  select line_total_ex_vat::text into v_txt from order_items where order_id = v_order and line_no = 1;
  perform pg_temp.kolla(5, 'radsumma härledd (10 x 42,50)', '425.00', v_txt);

  -- ── 6. orders.items härleds ur raderna ───────────────────────────────────
  select jsonb_array_length(items)::text into v_txt from orders where id = v_order;
  perform pg_temp.kolla(6, 'items har tre poster', '3', v_txt);
  select items->0->>'sku' into v_txt from orders where id = v_order;
  perform pg_temp.kolla(7, 'items i radordning', 'SMC-KQ2H06-00A', v_txt);

  -- ── 8. Leverantörsgruppering: en inköpsorder per leverantör ──────────────
  update order_items set intended_supplier_id = v_smc   where order_id = v_order and line_no = 1;
  update order_items set intended_supplier_id = v_festo where order_id = v_order and line_no = 2;

  select count(distinct intended_supplier_id)::int into v_int
    from order_items where order_id = v_order and intended_supplier_id is not null;
  perform pg_temp.kolla(8, 'två leverantörsgrupper', '2', v_int::text);

  select count(*)::int into v_int
    from order_items where order_id = v_order and intended_supplier_id is null;
  perform pg_temp.kolla(9, 'en rad kvar utan leverantör (kräver val)', '1', v_int::text);

  -- ── 10. Ren statusändring rör inte items ─────────────────────────────────
  select count(*)::int into v_int from audit_log where table_name = 'orders' and record_id = v_order::text;
  update order_items set status = 'shipped' where order_id = v_order and line_no = 1;
  select count(*)::int - v_int into v_int from audit_log where table_name = 'orders' and record_id = v_order::text;
  perform pg_temp.kolla(10, 'statusändring ger noll orders-uppdateringar', '0', v_int::text);

  -- ── 11. Verklig ändring uppdaterar items en gång ─────────────────────────
  select count(*)::int into v_int from audit_log where table_name = 'orders' and record_id = v_order::text;
  update order_items set qty = 12, line_total_ex_vat = 510.00 where order_id = v_order and line_no = 1;
  select count(*)::int - v_int into v_int from audit_log where table_name = 'orders' and record_id = v_order::text;
  perform pg_temp.kolla(11, 'ändrad kvantitet ger en orders-uppdatering', '1', v_int::text);
  select items->0->>'qty' into v_txt from orders where id = v_order;
  perform pg_temp.kolla(12, 'items speglar nya kvantiteten', '12', v_txt);

  -- ── 13. Orderns status härleds: levererad först när ALLA rader är det ────
  select case when bool_and(status = 'delivered') then 'levererad' else 'ej levererad' end
    into v_txt from order_items where order_id = v_order;
  perform pg_temp.kolla(13, 'ej levererad när en av tre är skickad', 'ej levererad', v_txt);
  update order_items set status = 'delivered' where order_id = v_order;
  select case when bool_and(status = 'delivered') then 'levererad' else 'ej levererad' end
    into v_txt from order_items where order_id = v_order;
  perform pg_temp.kolla(14, 'levererad när alla rader är det', 'levererad', v_txt);

  -- ── 15. SNAPSHOT: katalogen ändras, ordern står stilla ───────────────────
  -- Hela poängen med snapshots. Namnet skrivs tillbaka direkt efteråt, så
  -- provet lämnar inga spår i katalogen även om det körs utan transaktion.
  declare
    v_prod uuid := (select id from products order by sku limit 1);
    v_namn text;
  begin
    select name into v_namn from products where id = v_prod;
    update order_items set product_id = v_prod where order_id = v_order and line_no = 2;
    update products set name = 'OMDÖPT AV PROVET' where id = v_prod;
    select oi.name into v_txt from order_items oi where oi.order_id = v_order and oi.line_no = 2;
    perform pg_temp.kolla(15, 'orderraden orörd när produkten döps om', 'DSNU ø32', v_txt);
    update products set name = v_namn where id = v_prod;
    select count(*)::int into v_int from products where id = v_prod and name = v_namn;
    perform pg_temp.kolla(16, 'provet återställde produktnamnet', '1', v_int::text);
  end;

  -- ── 16–18. RLS ───────────────────────────────────────────────────────────
  -- Nollställ anspråken FÖRST. Utan raden kör "anon" vidare med föregående
  -- användares sub, och kontrollen blir meningslös -- den föll här första
  -- gången och visade 3 rader i stället för 0.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*)::int into v_int from order_items;
  reset role;
  perform pg_temp.kolla(17, 'anon ser inga orderrader', '0', v_int::text);

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_utomst), true);
  select count(*)::int into v_int from order_items;
  reset role;
  perform pg_temp.kolla(18, 'inloggad icke-ägare ser inga orderrader', '0', v_int::text);

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_agare), true);
  select count(*)::int into v_int from order_items where order_id = v_order;
  reset role;
  perform pg_temp.kolla(19, 'ägaren ser sina egna orderrader', '3', v_int::text);

  -- ── 19. Inköpspriser når aldrig en kundroll ──────────────────────────────
  -- Inköpspriset måste finnas för att kontrollen ska betyda något: en tom
  -- tabell ger noll rader åt alla och hade blivit falskt grönt.
  insert into supplier_products (supplier_id, supplier_sku, purchase_price, currency, price_source)
  values (v_smc, 'PROV-KQ2H06-00A', 19.90, 'SEK', 'manual');

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_utomst), true);
  select count(*)::int into v_int from supplier_products;
  reset role;
  perform pg_temp.kolla(20, 'inloggad utan admin ser inga inköpspriser', '0', v_int::text);

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_utomst), true);
  select count(*)::int into v_int from suppliers;
  reset role;
  perform pg_temp.kolla(21, 'inloggad utan admin ser inga leverantörer', '0', v_int::text);

  -- ...och att raden verkligen fanns att dölja.
  select count(*)::int into v_int from supplier_products where supplier_sku = 'PROV-KQ2H06-00A';
  perform pg_temp.kolla(24, 'inköpsprisraden fanns (kontroll 20 var inte tom-tabell)', '1', v_int::text);

  -- En okänd användare får inte kunna fälla skrivningen via audit-triggern.
  -- Det här föll med 23503 första gången: audit_log.user_id har en främmande
  -- nyckel mot auth.users, och triggern skrev auth.uid() rakt in. En logg ska
  -- anteckna vad som hände, aldrig avgöra om det får hända.
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_utomst), true);
  begin
    delete from supplier_products where supplier_sku = 'PROV-KQ2H06-00A';
    v_fel := 'ingen';
  exception when others then v_fel := 'kastade'; end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.kolla(25, 'audit-triggern blockerar inte skrivning från okänd användare',
                        'ingen', v_fel);

  delete from supplier_products where supplier_sku = 'PROV-KQ2H06-00A';

  -- ── 21. Audit-spår på båda tabellerna ────────────────────────────────────
  select count(*)::int into v_int from audit_log
   where table_name = 'order_items' and record_id in (select id::text from order_items where order_id = v_order);
  perform pg_temp.kolla(22, 'audit-rader finns för orderraderna', 'ja',
                        case when v_int > 0 then 'ja' else 'nej' end);

  -- ── 26–33. Ordernummer, idempotens, statushändelser ─────────────────────
  select order_number into v_txt from orders where id = v_order;
  perform pg_temp.kolla(26, 'ordernumret har formen MV-<år>-<5 siffror>', 'ja',
                        case when v_txt ~ ('^MV-' || extract(year from now())::int || '-[0-9]{5}$')
                             then 'ja' else 'nej: ' || coalesce(v_txt,'∅') end);

  declare v_o2 uuid; v_a uuid; v_b uuid; v_n1 int; v_n2 int;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_agare), true);
    v_o2 := create_order_with_items(
      format('{"user_id":"%s","customer_name":"Nr2","customer_email":"k@example.com"}', v_agare)::jsonb,
      '[{"sku":"A","name":"B","qty":1,"unit_price_ex_vat":1}]'::jsonb);

    -- Samma idempotensnyckel två gånger ska ge EN order.
    v_a := create_order_with_items(
      format('{"user_id":"%s","customer_name":"Dubbelklick","customer_email":"k@example.com",
               "idempotency_key":"prov-nyckel-1"}', v_agare)::jsonb,
      '[{"sku":"A","name":"B","qty":1,"unit_price_ex_vat":1}]'::jsonb);
    v_b := create_order_with_items(
      format('{"user_id":"%s","customer_name":"Dubbelklick","customer_email":"k@example.com",
               "idempotency_key":"prov-nyckel-1"}', v_agare)::jsonb,
      '[{"sku":"A","name":"B","qty":1,"unit_price_ex_vat":1}]'::jsonb);
    reset role;

    perform pg_temp.kolla(27, 'samma idempotensnyckel ger samma order', 'ja',
                          case when v_a = v_b then 'ja' else 'nej' end);
    select count(*)::int into v_int from orders where idempotency_key = 'prov-nyckel-1';
    perform pg_temp.kolla(28, 'bara EN order skapades av dubbelklicket', '1', v_int::text);
    select count(*)::int into v_int from order_items where order_id = v_a;
    perform pg_temp.kolla(29, 'dubbelklicket gav inte dubbla rader', '1', v_int::text);

    select (regexp_match(order_number, '([0-9]{5})$'))[1]::int into v_n1 from orders where id = v_order;
    select (regexp_match(order_number, '([0-9]{5})$'))[1]::int into v_n2 from orders where id = v_o2;
    perform pg_temp.kolla(30, 'nästa order får ett högre nummer', 'ja',
                          case when v_n2 > v_n1 then 'ja' else 'nej' end);

    delete from orders where id in (v_a, v_o2);
  end;

  -- Statushändelser skrivs av triggrar: ingen kodväg kan ändra en status utan
  -- att det syns, och notifieringarna får en tabell att hänga på.
  select count(*)::int into v_int from order_status_events
   where order_id = v_order and order_item_id is null;
  perform pg_temp.kolla(31, 'händelse loggad när ordern skapades', '1', v_int::text);

  select count(*)::int into v_int from order_status_events
   where order_id = v_order and order_item_id is not null;
  perform pg_temp.kolla(32, 'händelser loggade för radernas övergångar', 'ja',
                        case when v_int >= 4 then 'ja' else 'nej (' || v_int || ')' end);

  select from_status || '->' || to_status into v_txt from order_status_events
   where order_id = v_order and order_item_id is not null and from_status is not null
   order by created_at limit 1;
  perform pg_temp.kolla(33, 'första radövergången är pending->shipped', 'pending->shipped', v_txt);

  -- ── 23, 34. Kaskad ───────────────────────────────────────────────────────
  delete from orders where id = v_order;
  select count(*)::int into v_int from order_items where order_id = v_order;
  perform pg_temp.kolla(23, 'raderna följer med när ordern raderas', '0', v_int::text);
  select count(*)::int into v_int from order_status_events where order_id = v_order;
  perform pg_temp.kolla(34, 'händelserna följer med när ordern raderas', '0', v_int::text);
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- DEL 2: KUNDENS EGEN VÄG (offert -> acceptera -> order)
--
-- Den vanliga vägen till en order är inte adminsidan utan att kunden trycker
-- "Ja, acceptera offert" på /offert/:id. respond_to_quote() skrev länge
-- orders.items som en jsonb-array UTAN att skapa order_items -- en order lagd
-- av kunden själv var därför osynlig för Order Engine. Kontrollerna nedan
-- finns för att den vägen ska gå hand i hand med resten, inte bredvid.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_agare uuid := (select id from auth.users order by created_at limit 1);
  v_rfq uuid; v_p1 uuid; v_p2 uuid; v_ord uuid; v_ord2 uuid;
  v_txt text; v_int int; v_res record;
begin
  select id into v_p1 from products where status='active' order by sku limit 1;
  select id into v_p2 from products where status='active' and id <> v_p1 order by sku limit 1;

  insert into rfqs (id, user_id, status, contact_name, contact_email, company, org_number,
                    quote_currency, discount_pct, title)
  values (gen_random_uuid(), v_agare, 'quoted', 'Provkund', 'k@example.com', 'Provkund AB',
          '556000-0000', 'SEK', 10, 'Provoffert')
  returning id into v_rfq;

  -- sort_order, inte bara id: rfq_items.id är ett gen_random_uuid(), så
  -- `order by id` gav SLUMPMÄSSIG radordning. Kontroll 38 föll varannan
  -- körning på det, och kunden kunde få offert, orderbekräftelse och
  -- orderrader i tre olika ordningar.
  insert into rfq_items (rfq_id, product_id, qty, unit_price, role, sort_order)
  values (v_rfq, v_p1, 4, 250.00, 'ordered', 1), (v_rfq, v_p2, 2, 1000.00, 'ordered', 2);

  select * into v_res from respond_to_quote(v_rfq, 'accepted', 'PO-KUND-1');
  v_ord := v_res.order_id;

  perform pg_temp.kolla(35, 'accepterad offert ger en order', 'ja',
                        case when v_ord is not null then 'ja' else 'nej' end);
  select count(*)::int into v_int from order_items where order_id = v_ord;
  perform pg_temp.kolla(36, 'kundens order fick RADER, inte bara items-json', '2', v_int::text);
  select jsonb_array_length(items)::text into v_txt from orders where id = v_ord;
  perform pg_temp.kolla(37, 'items härledd ur raderna', '2', v_txt);

  -- Offertens rabatt måste slå igenom: 250 x 0,9 = 225 per styck, 4 st = 900.
  select line_total_ex_vat::text into v_txt from order_items where order_id=v_ord and line_no=1;
  perform pg_temp.kolla(38, 'radsumman följer offertens rabatt (4 x 225)', '900.00', v_txt);

  -- Radordningen är offertens, inte slumpens.
  select string_agg(oi.line_no::text || ':' || oi.qty::text, ',' order by oi.line_no)
    into v_txt from order_items oi where oi.order_id = v_ord;
  perform pg_temp.kolla(47, 'orderraderna kommer i offertens ordning', '1:4,2:2', v_txt);

  select count(*)::int into v_int from order_items where order_id=v_ord and product_id is not null;
  perform pg_temp.kolla(39, 'raderna är knutna till katalogen', '2', v_int::text);
  select order_number into v_txt from orders where id=v_ord;
  perform pg_temp.kolla(40, 'kundens order fick ett ordernummer', 'ja',
                        case when v_txt ~ '^MV-[0-9]{4}-[0-9]{5}$' then 'ja' else 'nej: '||coalesce(v_txt,'∅') end);
  select po_number into v_txt from orders where id=v_ord;
  perform pg_temp.kolla(41, 'kundens PO-nummer följde med', 'PO-KUND-1', v_txt);

  -- Admin konverterar SAMMA offert. Utan gemensam idempotensnyckel hade
  -- offerten fått två ordrar med olika nummer och olika rader.
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_agare), true);
  v_ord2 := create_order_with_items(
    format('{"user_id":"%s","rfq_id":"%s","customer_name":"Provkund","customer_email":"k@example.com",
             "idempotency_key":"rfq:%s"}', v_agare, v_rfq, v_rfq)::jsonb,
    '[{"sku":"DUBBLETT","name":"Skulle inte skapas","qty":1,"unit_price_ex_vat":1}]'::jsonb);
  reset role;
  perform pg_temp.kolla(42, 'admin-vägen ger SAMMA order, ingen dubblett', 'ja',
                        case when v_ord2 = v_ord then 'ja' else 'nej' end);
  select count(*)::int into v_int from orders where rfq_id = v_rfq;
  perform pg_temp.kolla(43, 'offerten har exakt en order', '1', v_int::text);
  select count(*)::int into v_int from order_items where order_id=v_ord;
  perform pg_temp.kolla(44, 'inga extrarader från andra försöket', '2', v_int::text);

  select * into v_res from respond_to_quote(v_rfq, 'accepted', null);
  perform pg_temp.kolla(45, 'andra accepten gör ingenting', 'false', v_res.success::text);

  select count(*)::int into v_int from order_status_events where order_id = v_ord;
  perform pg_temp.kolla(46, 'statushändelser loggade för kundens order', 'ja',
                        case when v_int >= 3 then 'ja' else 'nej ('||v_int||')' end);

  delete from orders where id = v_ord;
  delete from rfqs where id = v_rfq;
end $$;

-- ── DEL 3: konfiguratorns orderkod hela vägen ──────────────────────────────
--
-- Konfiguratorn bygger en KOD, katalogen har en SERIE. Kedjan
-- inköpslista -> offert -> order bar bara product_id, så koden hade tappats i
-- första steget och offerten visat "FESTO-DSNU" i stället för
-- "DSNU-32-100-PPS-A". Kontrollerna nedan följer koden hela vägen fram, och
-- vaktar dessutom att en rad med fel sorts id inte fäller hela förfrågan.

do $$
declare
  v_prod uuid := (select id from products where status='active' and family is not null order by sku limit 1);
  v_rfq  uuid;
  v_rad  record;
  v_ord  uuid;
  v_res  record;
  v_txt  text;
begin
  select submit_rfq('PROV','Prov Provsson','prov-orderkod@example.invalid','','Provbolaget','','','',
    jsonb_build_array(
      jsonb_build_object('product_id', v_prod::text, 'qty', 2, 'role','ordered'),
      jsonb_build_object('product_id', v_prod::text, 'qty', 1, 'order_code','DSNU-32-100-PPS-A'),
      jsonb_build_object('product_id', null, 'qty', 3, 'order_code','CY1L-25-500', 'item_name','CY1L bandlös cylinder'),
      -- projects.tsx skickade SKU:n som id. Casten dödade hela anropet.
      jsonb_build_object('product_id', 'FESTO-DSNU', 'qty', 1),
      -- Varken produkt eller kod: skräp, ska hoppas över.
      jsonb_build_object('qty', 9)
    ), '') into v_rfq;

  perform pg_temp.kolla(48, 'fyra giltiga rader in, skräpraden bort', '4',
                        (select count(*)::text from rfq_items where rfq_id=v_rfq));

  select * into v_rad from rfq_items where rfq_id=v_rfq and order_code='DSNU-32-100-PPS-A';
  perform pg_temp.kolla(49, 'konfigurerad rad behåller seriens produkt-id',
                        v_prod::text, coalesce(v_rad.product_id::text,'∅'));

  select * into v_rad from rfq_items where rfq_id=v_rfq and order_code='CY1L-25-500';
  perform pg_temp.kolla(50, 'familj utan katalogpost: kod utan produkt', 'ja',
                        case when v_rad.product_id is null then 'ja' else 'nej' end);
  perform pg_temp.kolla(51, 'radens eget namn sparas', 'CY1L bandlös cylinder',
                        coalesce(v_rad.item_name,'∅'));

  select * into v_rad from rfq_items where rfq_id=v_rfq and order_code='FESTO-DSNU';
  perform pg_temp.kolla(52, 'trasigt id bevaras som kod i stället för att fälla anropet', 'ja',
                        case when v_rad.id is not null and v_rad.product_id is null then 'ja' else 'nej' end);

  perform pg_temp.kolla(53, 'kunden ser koden i sku-kolumnen', 'DSNU-32-100-PPS-A',
                        coalesce((select sku from get_quote_items(v_rfq) where sku='DSNU-32-100-PPS-A'),'∅'));
  perform pg_temp.kolla(54, 'katalograden visar fortfarande sitt eget sku', 'ja',
                        case when exists(select 1 from get_quote_items(v_rfq) g
                                         join products p on p.id=v_prod where g.sku=p.sku)
                             then 'ja' else 'nej' end);

  update rfq_items set unit_price = 100 where rfq_id = v_rfq;
  update rfqs set status='quoted', quote_amount=1000, discount_pct=0 where id=v_rfq;
  select * into v_res from respond_to_quote(v_rfq, 'accepted', 'PO-PROV');
  v_ord := v_res.order_id;

  perform pg_temp.kolla(55, 'ordern fick fyra rader', '4',
                        (select count(*)::text from order_items where order_id=v_ord));
  perform pg_temp.kolla(56, 'orderraden bär orderkoden, inte serien', 'ja',
                        case when exists(select 1 from order_items where order_id=v_ord and sku='DSNU-32-100-PPS-A')
                             then 'ja' else 'nej' end);
  perform pg_temp.kolla(57, 'raden utan katalogpost fick sitt namn', 'CY1L bandlös cylinder',
                        coalesce((select name from order_items where order_id=v_ord and sku='CY1L-25-500'),'∅'));
  perform pg_temp.kolla(58, 'konfigurerad orderrad är fortfarande knuten till katalogen',
                        v_prod::text,
                        coalesce((select product_id::text from order_items where order_id=v_ord and sku='DSNU-32-100-PPS-A'),'∅'));

  -- Offerten och ordern ska lista raderna i den ordning kunden lade dem.
  -- rfq_items.id är ett slumpat uuid; utan sort_order var ordningen slumpens.
  select string_agg(g.qty::text, ',') into v_txt from get_quote_items(v_rfq) g;
  perform pg_temp.kolla(59, 'offerten listar raderna i inköpslistans ordning', '2,1,3,1', v_txt);

  delete from orders where id = v_ord;
  delete from rfqs where id = v_rfq;
end $$;

-- ── DEL 4: kundordern blir inköpsordrar ───────────────────────────────────
--
-- §18:s kärna: en order med produkter från flera leverantörer ska ge EN order
-- till kunden och EN inköpsorder PER LEVERANTÖR. Kontrollerna nedan vaktar
-- också de två sätt det kan gå tyst fel på: en rad vars leverantör vi inte vet
-- får inte försvinna, och en om-körning får aldrig beställa samma sak igen.

do $$
declare
  v_admin  uuid := (select id from auth.users order by created_at limit 1);
  v_utomst uuid := '00000000-0000-0000-0000-00000000f002';
  v_festo1 uuid; v_festo2 uuid; v_smc uuid;
  v_ord uuid; v_txt text; v_int int;
begin
  select p.id into v_festo1 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' order by p.sku limit 1;
  select p.id into v_festo2 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' and p.id<>v_festo1 order by p.sku limit 1;
  select p.id into v_smc from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='smc' order by p.sku limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_admin), true);

  v_ord := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Provkund","customer_email":"k@example.com","po_number":"PO-77"}', v_admin)::jsonb,
    format('[{"product_id":"%s","sku":"A","name":"Festo ett","qty":2,"unit_price_ex_vat":100},
             {"product_id":"%s","sku":"B","name":"Festo tva","qty":1,"unit_price_ex_vat":200},
             {"product_id":"%s","sku":"C","name":"SMC ett","qty":4,"unit_price_ex_vat":50},
             {"sku":"CY1L-25-500","name":"Utan katalogpost","qty":1,"unit_price_ex_vat":10}]',
           v_festo1, v_festo2, v_smc)::jsonb);

  select count(*)::int into v_int from create_supplier_pos(v_ord);
  perform pg_temp.kolla(60, 'tre leverantörer: Festo, SMC och den okända', '3', v_int::text);
  select count(*)::int into v_int from supplier_purchase_orders where order_id=v_ord;
  perform pg_temp.kolla(61, 'en inköpsorder per leverantör', '3', v_int::text);

  select string_agg(coalesce(s.name,'OKÄND')||':'||
                    (select count(*) from supplier_purchase_order_items i where i.spo_id=spo.id),
                    ', ' order by coalesce(s.name,'ZZ'))
    into v_txt from supplier_purchase_orders spo left join suppliers s on s.id=spo.supplier_id
   where spo.order_id=v_ord;
  perform pg_temp.kolla(62, 'raderna hamnade hos rätt leverantör', 'Festo:2, SMC:1, OKÄND:1', v_txt);

  select count(*)::int into v_int from supplier_purchase_orders
   where order_id=v_ord and po_number ~ '^MPO-[0-9]{4}-[0-9]{5}$';
  perform pg_temp.kolla(63, 'alla fick ett MPO-nummer', '3', v_int::text);
  select count(*)::int into v_int from order_items where order_id=v_ord and intended_supplier_id is not null;
  perform pg_temp.kolla(64, 'orderraden vet vilken leverantör den gick till', '3', v_int::text);
  select count(*)::int into v_int from supplier_purchase_orders where order_id=v_ord and needs_review;
  perform pg_temp.kolla(65, 'markerade för granskning så länge inköpspriset saknas', '3', v_int::text);
  select review_reason into v_txt from supplier_purchase_orders where order_id=v_ord and supplier_id is null;
  perform pg_temp.kolla(66, 'den okända leverantören säger varför', 'okänd leverantör; inköpspris saknas', v_txt);

  -- Om-körningen är hela poängen med idempotensnyckeln: ett andra klick, en
  -- omkörd webhook eller ett nytt försök efter avbrott får inte köpa igen.
  perform create_supplier_pos(v_ord);
  select count(*)::int into v_int from supplier_purchase_orders where order_id=v_ord;
  perform pg_temp.kolla(67, 'om-körning skapar inga nya inköpsordrar', '3', v_int::text);
  select count(*)::int into v_int from supplier_purchase_order_items i
    join supplier_purchase_orders spo on spo.id=i.spo_id where spo.order_id=v_ord;
  perform pg_temp.kolla(68, 'om-körning skapar inga extrarader', '4', v_int::text);

  -- Inköpspriset är intern information (§16).
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_utomst), true);
  select count(*)::int into v_int from supplier_purchase_orders;
  perform pg_temp.kolla(69, 'kundroll ser inga inköpsordrar', '0', v_int::text);
  select count(*)::int into v_int from supplier_purchase_order_items;
  perform pg_temp.kolla(70, 'kundroll ser inga inköpsrader, alltså inget inköpspris', '0', v_int::text);
  begin
    perform create_supplier_pos(v_ord);
    perform pg_temp.kolla(71, 'kundroll får inte skapa inköpsordrar', 'avvisad', 'gick igenom');
  exception when others then
    perform pg_temp.kolla(71, 'kundroll får inte skapa inköpsordrar', 'avvisad', 'avvisad');
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from orders where id=v_ord;
  select count(*)::int into v_int from supplier_purchase_orders where order_id=v_ord;
  perform pg_temp.kolla(72, 'inköpsordrarna följer med när ordern raderas', '0', v_int::text);
end $$;

-- ── DEL 5: en orderrad som tillkommer efteråt ─────────────────────────────
--
-- Kunden ringer och lägger till en cylinder efter att inköpsordrarna skapats.
-- Trycker administratören "Skapa" igen hoppade funktionen förut över hela
-- leverantören ("finns redan") och raden hamnade i INGEN inköpsorder. Ingen
-- hade beställt den, och ingenting hade sagt ifrån.

do $$
declare
  v_admin uuid := (select id from auth.users order by created_at limit 1);
  v_festo uuid; v_smc uuid;
  v_ord uuid; v_spo uuid; v_int int; v_txt text;
begin
  select p.id into v_festo from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' order by p.sku limit 1;
  select p.id into v_smc from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='smc' order by p.sku limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_admin), true);

  v_ord := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Provkund","customer_email":"k@example.com"}', v_admin)::jsonb,
    format('[{"product_id":"%s","sku":"A","name":"Festo ett","qty":1,"unit_price_ex_vat":100}]', v_festo)::jsonb);
  perform create_supplier_pos(v_ord);

  insert into order_items (order_id, line_no, product_id, sku, name, qty, unit_price_ex_vat)
  values (v_ord, 99, v_smc, 'C', 'SMC efterhandling', 3, 50);
  perform create_supplier_pos(v_ord);
  select count(*)::int into v_int from supplier_purchase_orders where order_id=v_ord;
  perform pg_temp.kolla(73, 'ny leverantör efteråt får en egen inköpsorder', '2', v_int::text);

  insert into order_items (order_id, line_no, product_id, sku, name, qty, unit_price_ex_vat)
  values (v_ord, 98, v_festo, 'A2', 'Festo efterhandling', 2, 120);
  perform create_supplier_pos(v_ord);
  select spo.id into v_spo from supplier_purchase_orders spo
    join suppliers s on s.id=spo.supplier_id where spo.order_id=v_ord and s.slug='festo';
  select count(*)::int into v_int from supplier_purchase_order_items where spo_id=v_spo;
  perform pg_temp.kolla(74, 'utkastet fylls på med den nya raden', '2', v_int::text);
  select string_agg(line_no::text, ',' order by line_no) into v_txt
    from supplier_purchase_order_items where spo_id=v_spo;
  perform pg_temp.kolla(75, 'radnumreringen fortsätter, den börjar inte om', '1,2', v_txt);

  -- Skickad inköpsorder: leverantören har ett papper som inte längre stämmer.
  update supplier_purchase_orders set status='sent', needs_review=false, review_reason=null where id=v_spo;
  insert into order_items (order_id, line_no, product_id, sku, name, qty, unit_price_ex_vat)
  values (v_ord, 97, v_festo, 'A3', 'Festo efter utskick', 1, 90);
  perform create_supplier_pos(v_ord);
  select count(*)::int into v_int from supplier_purchase_order_items where spo_id=v_spo;
  perform pg_temp.kolla(76, 'skickad inköpsorder får INTE nya rader i smyg', '2', v_int::text);
  select review_reason into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(77, 'den säger ifrån i stället',
                        '1 nya orderrader efter att inköpsordern skickades', v_txt);
  select needs_review::text into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(78, 'och flaggas för granskning', 'true', v_txt);

  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from orders where id=v_ord;
end $$;

-- ── DEL 6: klassningen grön/gul/röd ───────────────────────────────────────
--
-- §5: leverantören svarar sällan bara "ja". Varje avvikelse ska klassas, och
-- den värsta nivån på en rad vinner. Fallen nedan är specens tretton
-- situationer plus gränsfallen kring toleranserna.

do $$
declare
  f record; k record;
  v_nr int := 78;
begin
  for f in
    select * from (values
      ('allt som bestallt',              10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-12'::date, 'accepted', null::text, 0::numeric, 0, 'gron'),
      ('tidigare leverans ar ingen avvikelse', 10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-05'::date, 'accepted', null, 0::numeric, 0, 'gron'),
      ('avvisad rad',                    10::numeric, 100::numeric, '2026-10-12'::date, null::numeric, null::numeric, null::date, 'rejected', null, 0::numeric, 0, 'rod'),
      ('restnoterad',                    10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-12'::date, 'backordered', null, 0::numeric, 0, 'rod'),
      ('utgangen produkt',               10::numeric, 100::numeric, '2026-10-12'::date, null::numeric, null::numeric, null::date, 'discontinued', null, 0::numeric, 0, 'rod'),
      ('teknisk fraga',                  10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-12'::date, 'question', null, 0::numeric, 0, 'rod'),
      ('ersattningsprodukt',             10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-12'::date, 'accepted', 'DSNU-32-100-PPV', 5::numeric, 5, 'rod'),
      ('delvis: tre av fem',             5::numeric,  100::numeric, '2026-10-12'::date, 3::numeric,  100::numeric, '2026-10-12'::date, 'accepted', null, 0::numeric, 0, 'rod'),
      ('pris inom tolerans',             10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 103::numeric, '2026-10-12'::date, 'accepted', null, 5::numeric, 0, 'gul'),
      ('pris over tolerans',             10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 110::numeric, '2026-10-12'::date, 'accepted', null, 5::numeric, 0, 'rod'),
      ('utan tolerans ar varje prisandring rod', 10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100.5::numeric, '2026-10-12'::date, 'accepted', null, 0::numeric, 0, 'rod'),
      ('okant pris hos oss blir gult',   10::numeric, null::numeric, '2026-10-12'::date, 10::numeric, 512.5::numeric, '2026-10-12'::date, 'accepted', null, 0::numeric, 0, 'gul'),
      ('forsening inom tolerans',        10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-15'::date, 'accepted', null, 0::numeric, 5, 'gul'),
      ('stor forsening',                 10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 100::numeric, '2026-10-30'::date, 'accepted', null, 0::numeric, 5, 'rod'),
      ('gul plus rod blir rod',          10::numeric, 100::numeric, '2026-10-12'::date, 8::numeric,  103::numeric, '2026-10-14'::date, 'accepted', null, 5::numeric, 5, 'rod'),
      ('tva gula blir gul',              10::numeric, 100::numeric, '2026-10-12'::date, 10::numeric, 103::numeric, '2026-10-14'::date, 'accepted', null, 5::numeric, 5, 'gul')
    ) as t(beskrivning, ba, bp, ol, ka, kp, kl, svar, ers, ptol, dtol, vantad)
  loop
    v_nr := v_nr + 1;
    select * into k from klassificera_avvikelse(f.ba, f.bp, f.ol, f.ka, f.kp, f.kl, f.svar, f.ers, f.ptol, f.dtol);
    perform pg_temp.kolla(v_nr, 'klassning: ' || f.beskrivning, f.vantad, k.niva);
  end loop;
end $$;

-- ── DEL 7: bekräftelsen hela vägen ────────────────────────────────────────
--
-- §18 punkt 7 och 8: en leverantör bekräftar hela sin del, en bekräftar bara
-- en rad och flyttar den andra. Den stoppade raden får inte smyga vidare till
-- kunden, och den får inte gå vidare förrän en människa tagit beslutet.

do $$
declare
  v_admin uuid := (select id from auth.users order by created_at limit 1);
  v_f1 uuid; v_f2 uuid; v_s1 uuid;
  v_ord uuid; v_spo_festo uuid; v_spo_smc uuid;
  v_r1 uuid; v_r2 uuid; v_rs uuid;
  v_res record; v_txt text; v_int int;
begin
  select p.id into v_f1 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' order by p.sku limit 1;
  select p.id into v_f2 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' and p.id<>v_f1 order by p.sku limit 1;
  select p.id into v_s1 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='smc' order by p.sku limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_admin), true);

  v_ord := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Provkund","customer_email":"k@example.com"}', v_admin)::jsonb,
    format('[{"product_id":"%s","sku":"A","name":"Festo ett","qty":5,"unit_price_ex_vat":100},
             {"product_id":"%s","sku":"B","name":"Festo tva","qty":2,"unit_price_ex_vat":200},
             {"product_id":"%s","sku":"C","name":"SMC ett","qty":4,"unit_price_ex_vat":50}]',
           v_f1, v_f2, v_s1)::jsonb);
  perform create_supplier_pos(v_ord);

  select spo.id into v_spo_festo from supplier_purchase_orders spo join suppliers s on s.id=spo.supplier_id
   where spo.order_id=v_ord and s.slug='festo';
  select spo.id into v_spo_smc from supplier_purchase_orders spo join suppliers s on s.id=spo.supplier_id
   where spo.order_id=v_ord and s.slug='smc';

  -- Inköpspris och önskat datum, så klassningen har något att jämföra mot.
  update supplier_purchase_order_items set unit_purchase_price=60 where spo_id=v_spo_festo;
  update supplier_purchase_order_items set unit_purchase_price=30 where spo_id=v_spo_smc;
  update supplier_purchase_orders set expected_delivery = current_date + 14, sent_at = now(), status='sent'
   where id in (v_spo_festo, v_spo_smc);

  select id into v_r1 from supplier_purchase_order_items where spo_id=v_spo_festo and line_no=1;
  select id into v_r2 from supplier_purchase_order_items where spo_id=v_spo_festo and line_no=2;
  select id into v_rs from supplier_purchase_order_items where spo_id=v_spo_smc  and line_no=1;

  select * into v_res from register_supplier_ack(v_spo_smc,
    jsonb_build_array(jsonb_build_object('spoi_id', v_rs, 'qty', 4, 'unit_price', 30,
                                         'delivery_date', (current_date + 14)::text, 'response','accepted')),
    'manual', 'SMC-ORD-9912', 'Bekraftad per mejl');
  perform pg_temp.kolla(95, 'SMC: helt bekräftad utan avvikelse', 'gron', v_res.worst_level);
  select status into v_txt from supplier_purchase_orders where id=v_spo_smc;
  perform pg_temp.kolla(96, 'inköpsordern blir acknowledged', 'acknowledged', v_txt);
  select oi.status into v_txt from order_items oi join supplier_purchase_order_items i on i.order_item_id=oi.id
   where i.id=v_rs;
  perform pg_temp.kolla(97, 'kundens orderrad blir bekräftad', 'acknowledged', v_txt);

  -- Leverantörens egna ord sparas, men de är INTERNA: kundens text byggs ur
  -- de strukturerade fälten, inte ur den här noteringen.
  select * into v_res from register_supplier_ack(v_spo_festo,
    jsonb_build_array(
      jsonb_build_object('spoi_id', v_r1, 'qty', 5, 'unit_price', 60,
                         'delivery_date', (current_date + 14)::text, 'response','accepted'),
      jsonb_build_object('spoi_id', v_r2, 'qty', 2, 'unit_price', 66,
                         'delivery_date', (current_date + 45)::text, 'response','accepted',
                         'note','PO ACK line 20 rescheduled due ATP constraint')),
    'manual', 'FESTO-4711', null);
  perform pg_temp.kolla(98, 'Festo: en grön och en röd', 'gron=1 gul=0 rod=1',
                        format('gron=%s gul=%s rod=%s', v_res.antal_gron, v_res.antal_gul, v_res.antal_rod));
  perform pg_temp.kolla(99, 'värsta nivån styr bekräftelsen', 'rod', v_res.worst_level);
  select status into v_txt from supplier_purchase_orders where id=v_spo_festo;
  perform pg_temp.kolla(100, 'delvis bekräftad inköpsorder', 'partially_acknowledged', v_txt);
  select status into v_txt from supplier_purchase_order_items where id=v_r2;
  perform pg_temp.kolla(101, 'den röda raden är STOPPAD', 'blocked', v_txt);
  select ack_reason into v_txt from supplier_purchase_order_items where id=v_r2;
  perform pg_temp.kolla(102, 'skälet nämner både pris och försening', 'ja',
    case when v_txt like '%pris%' and v_txt like '%dagar senare%' then 'ja' else 'nej: '||coalesce(v_txt,'-') end);
  select oi.status into v_txt from order_items oi join supplier_purchase_order_items i on i.order_item_id=oi.id
   where i.id=v_r2;
  perform pg_temp.kolla(103, 'kundens rad blir INTE bekräftad av en stoppad rad', 'pending', v_txt);
  select needs_review::text into v_txt from supplier_purchase_orders where id=v_spo_festo;
  perform pg_temp.kolla(104, 'inköpsordern flaggas för granskning', 'true', v_txt);

  perform godkann_avvikelse(v_r2, 'approve');
  select status into v_txt from supplier_purchase_order_items where id=v_r2;
  perform pg_temp.kolla(105, 'godkänd rad', 'approved', v_txt);
  select trim_scale(unit_purchase_price)::text into v_txt from supplier_purchase_order_items where id=v_r2;
  perform pg_temp.kolla(106, 'leverantörens pris gäller efter godkännandet', '66', v_txt);
  select status into v_txt from supplier_purchase_orders where id=v_spo_festo;
  perform pg_temp.kolla(107, 'inköpsordern är klar när ingen rad väntar', 'acknowledged', v_txt);
  select oi.status into v_txt from order_items oi join supplier_purchase_order_items i on i.order_item_id=oi.id
   where i.id=v_r2;
  perform pg_temp.kolla(108, 'kundens rad bekräftas först efter godkännandet', 'acknowledged', v_txt);

  begin
    perform godkann_avvikelse(v_r1, 'approve');
    perform pg_temp.kolla(109, 'godkännande av icke-stoppad rad avvisas', 'avvisad', 'gick igenom');
  exception when others then
    perform pg_temp.kolla(109, 'godkännande av icke-stoppad rad avvisas', 'avvisad', 'avvisad');
  end;

  select count(*)::int into v_int from supplier_acknowledgements where spo_id in (v_spo_festo, v_spo_smc);
  perform pg_temp.kolla(110, 'två bekräftelser sparade med sitt råmaterial', '2', v_int::text);
  select count(*)::int into v_int from order_status_events where order_id = v_ord;
  perform pg_temp.kolla(111, 'statushändelser loggade för kundens rader', 'ja',
                        case when v_int >= 3 then 'ja' else 'nej ('||v_int||')' end);

  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from orders where id=v_ord;
end $$;

-- ── DEL 8: leverantören svarar inte på allt ───────────────────────────────
--
-- Specens "saknad artikel", och det tysta fallet: svarar leverantören på två
-- av fem rader stod inköpsordern som "bekräftad" medan tre rader aldrig fått
-- ett ord. Ingen hade märkt det förrän leveransen kom ofullständig.

do $$
declare
  v_admin uuid := (select id from auth.users order by created_at limit 1);
  v_f1 uuid; v_f2 uuid;
  v_ord uuid; v_spo uuid; v_r1 uuid; v_r2 uuid;
  v_txt text;
begin
  select p.id into v_f1 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' order by p.sku limit 1;
  select p.id into v_f2 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' and p.id<>v_f1 order by p.sku limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_admin), true);

  v_ord := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Provkund","customer_email":"k@example.com"}', v_admin)::jsonb,
    format('[{"product_id":"%s","sku":"A","name":"ett","qty":1,"unit_price_ex_vat":100},
             {"product_id":"%s","sku":"B","name":"tva","qty":1,"unit_price_ex_vat":100}]', v_f1, v_f2)::jsonb);
  perform create_supplier_pos(v_ord);
  select spo.id into v_spo from supplier_purchase_orders spo where spo.order_id=v_ord;
  update supplier_purchase_order_items set unit_purchase_price=50 where spo_id=v_spo;
  update supplier_purchase_orders set expected_delivery=current_date+14, sent_at=now(), status='sent' where id=v_spo;
  select id into v_r1 from supplier_purchase_order_items where spo_id=v_spo and line_no=1;
  select id into v_r2 from supplier_purchase_order_items where spo_id=v_spo and line_no=2;

  perform register_supplier_ack(v_spo,
    jsonb_build_array(jsonb_build_object('spoi_id', v_r1, 'qty', 1, 'unit_price', 50,
                                         'delivery_date', (current_date+14)::text, 'response','accepted')));
  select status into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(112, 'halvt besvarad inköpsorder är INTE bekräftad', 'partially_acknowledged', v_txt);
  select review_reason into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(113, 'och den säger hur många som saknar svar', 'ja',
    case when v_txt like '%1 rader saknar svar%' then 'ja' else 'nej: '||coalesce(v_txt,'-') end);

  perform register_supplier_ack(v_spo,
    jsonb_build_array(jsonb_build_object('spoi_id', v_r2, 'qty', 1, 'unit_price', 50,
                                         'delivery_date', (current_date+14)::text, 'response','accepted')));
  select status into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(114, 'bekräftad först när varje rad svarat', 'acknowledged', v_txt);
  select needs_review::text into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(115, 'och granskningsflaggan släcks', 'false', v_txt);

  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from orders where id=v_ord;
end $$;

-- ── DEL 9: de avledda värdena räknas om ───────────────────────────────────
--
-- Hittat genom att TITTA på adminvyn: en inköpsorder vars rader hade priser
-- stod ändå som "inget inköpspris". total_purchase_ex_vat, needs_review och
-- review_reason sattes en gång vid skapandet och rördes aldrig igen. PDF:en
-- räknade sin egen summa ur raderna och hade rätt, medan listan bredvid hade
-- fel -- två sanningar om samma order.

do $$
declare
  v_admin uuid := (select id from auth.users order by created_at limit 1);
  v_f1 uuid; v_ord uuid; v_spo uuid; v_r1 uuid; v_txt text;
begin
  select p.id into v_f1 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' order by p.sku limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_admin), true);

  v_ord := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Rollupprov","customer_email":"r@example.invalid"}', v_admin)::jsonb,
    format('[{"product_id":"%s","sku":"A","name":"ett","qty":2,"unit_price_ex_vat":100}]', v_f1)::jsonb);
  perform create_supplier_pos(v_ord);
  select spo.id into v_spo from supplier_purchase_orders spo where spo.order_id=v_ord;

  perform pg_temp.kolla(116, 'utan inköpspris: ingen summa', 'ja',
    case when (select total_purchase_ex_vat from supplier_purchase_orders where id=v_spo) is null
         then 'ja' else 'nej' end);
  select review_reason into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(117, 'och skälet säger inköpspris saknas', 'ja',
    case when v_txt like '%inköpspris saknas%' then 'ja' else 'nej: '||coalesce(v_txt,'-') end);

  -- Priset kommer in efteråt. Summan och skälet ska följa med.
  update supplier_purchase_order_items set unit_purchase_price=60, line_total_ex_vat=120 where spo_id=v_spo;
  perform create_supplier_pos(v_ord);
  perform pg_temp.kolla(118, 'summan räknas om när priset kommer', '120',
    (select trim_scale(total_purchase_ex_vat)::text from supplier_purchase_orders where id=v_spo));
  select coalesce(review_reason,'-') into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(119, 'och skälet slutar säga att priset saknas', 'ja',
    case when v_txt not like '%inköpspris saknas%' then 'ja' else 'nej: '||v_txt end);

  -- Ett godkänt leverantörssvar ändrar priset: summan ska följa.
  update supplier_purchase_orders set expected_delivery=current_date+14, sent_at=now(), status='sent' where id=v_spo;
  select id into v_r1 from supplier_purchase_order_items where spo_id=v_spo and line_no=1;
  perform register_supplier_ack(v_spo,
    jsonb_build_array(jsonb_build_object('spoi_id', v_r1, 'qty', 2, 'unit_price', 75,
                                         'delivery_date', (current_date+14)::text, 'response','accepted')));
  perform godkann_avvikelse(v_r1, 'approve');
  perform pg_temp.kolla(120, 'summan följer ett godkänt prisbyte (2 x 75)', '150',
    (select trim_scale(total_purchase_ex_vat)::text from supplier_purchase_orders where id=v_spo));
  -- Ett skäl utan flagga är en varning ingen ser, och tvärtom.
  perform pg_temp.kolla(121, 'granskningsflaggan och skälet är överens', 'ja',
    case when (select needs_review from supplier_purchase_orders where id=v_spo)
              = ((select review_reason from supplier_purchase_orders where id=v_spo) is not null)
         then 'ja' else 'nej' end);

  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from orders where id=v_ord;
end $$;

-- ── DEL 10: en leverantör vi inte aktiverat ───────────────────────────────
--
-- Hittat genom att titta på /admin/leverantorer i webbläsaren. Sidan har hela
-- tiden sagt "Order Engine får inte beställa från en leverantör som inte är
-- aktiv", och ingen kod läste suppliers.is_active. Alla åtta står som
-- inaktiva, och systemet skapade ändå inköpsordrar åt dem utan ett ord.
--
-- Att SKAPA inköpsordern är fortfarande tillåtet -- utkastet är just det som
-- behövs för att se vad som saknas. Det är att SKICKA den som stoppas, och det
-- hindret ligger i supplier-po (po-document.ts).

do $$
declare
  v_admin uuid := (select id from auth.users order by created_at limit 1);
  v_f1 uuid; v_ord uuid; v_spo uuid; v_festo uuid; v_txt text; v_fel text;
begin
  select p.id into v_f1 from products p join brands b on b.id=p.brand_id
   where p.status='active' and b.slug='festo' order by p.sku limit 1;
  select id into v_festo from suppliers where slug='festo';

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_admin), true);

  -- Omräknaren äger de avledda värdena och ska inte gå att nå utifrån.
  begin
    perform uppdatera_inkopsorderstatus(gen_random_uuid());
    v_fel := 'gick igenom';
  exception when insufficient_privilege then v_fel := 'avvisad';
  end;
  perform pg_temp.kolla(122, 'omräknaren är intern och nås inte av en inloggad', 'avvisad', v_fel);

  v_ord := create_order_with_items(
    format('{"user_id":"%s","customer_name":"Aktivprov","customer_email":"a@example.invalid"}', v_admin)::jsonb,
    format('[{"product_id":"%s","sku":"A","name":"ett","qty":1,"unit_price_ex_vat":100}]', v_f1)::jsonb);
  perform create_supplier_pos(v_ord);
  select spo.id into v_spo from supplier_purchase_orders spo where spo.order_id=v_ord;

  select review_reason into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(123, 'inaktiv leverantör syns som granskningsskäl', 'ja',
    case when v_txt like '%inte aktiverad%' then 'ja' else 'nej: '||coalesce(v_txt,'-') end);

  update suppliers set is_active = true where id = v_festo;
  perform create_supplier_pos(v_ord);
  select coalesce(review_reason,'-') into v_txt from supplier_purchase_orders where id=v_spo;
  perform pg_temp.kolla(124, 'och försvinner när leverantören aktiveras', 'ja',
    case when v_txt not like '%inte aktiverad%' then 'ja' else 'nej: '||v_txt end);

  -- Provet rör en rad UTANFÖR sin egen order och måste därför städa efter sig.
  update suppliers set is_active = false where id = v_festo;
  perform create_supplier_pos(v_ord);
  perform pg_temp.kolla(125, 'provet lämnade leverantören inaktiv', 'false',
    (select is_active::text from suppliers where id=v_festo));

  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from orders where id=v_ord;
end $$;

-- ── DEL 11: offert och beställning är olika saker ─────────────────────────
--
-- Kunden hade bara EN knapp, "Begär offert", och accepten av offerten blev
-- ordern. Det gick alltså varken att bara fråga efter priser eller att
-- beställa. Avsikten sätts nu när kunden trycker och följer med hela vägen.
--
-- Kontroll 130 är den som betyder något: en beställning får inte skickas
-- tillbaka till kunden som en offert att godkänna. Den frågan är besvarad.

do $$
declare
  v_p uuid; v_offert uuid; v_order uuid; v_txt text; v_fel text; v_res record; v_tredje uuid;
begin
  select id into v_p from products where status='active' order by sku limit 1;

  select submit_rfq('Prov','Provkund','q@example.invalid','','','','','',
    jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',2)), '', 'quote') into v_offert;
  select intent into v_txt from rfqs where id=v_offert;
  perform pg_temp.kolla(126, 'offertförfrågan får intent quote', 'quote', v_txt);

  select submit_rfq('Prov','Provkund','o@example.invalid','','','','','',
    jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',2)), '', 'order') into v_order;
  select intent into v_txt from rfqs where id=v_order;
  perform pg_temp.kolla(127, 'beställning får intent order', 'order', v_txt);

  -- Utan angiven avsikt blir det det försiktiga svaret.
  select submit_rfq('Prov','Provkund','d@example.invalid','','','','','',
    jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',1))) into v_tredje;
  perform pg_temp.kolla(128, 'utan avsikt blir det offert, inte order', 'quote',
    (select intent from rfqs where id=v_tredje));

  begin
    perform submit_rfq('Prov','P','x@example.invalid','','','','','',
      jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',1)), '', 'kanske');
    v_fel := 'gick igenom';
  exception when others then v_fel := 'avvisad';
  end;
  perform pg_temp.kolla(129, 'okänd avsikt avvisas', 'avvisad', v_fel);

  update rfqs set status='quoted' where id=v_order;
  begin
    perform respond_to_quote(v_order, 'accepted', null);
    v_fel := 'gick igenom';
  exception when others then v_fel := 'avvisad';
  end;
  perform pg_temp.kolla(130, 'beställning kan inte accepteras som offert', 'avvisad', v_fel);

  update rfq_items set unit_price=100 where rfq_id=v_offert;
  update rfqs set status='quoted', discount_pct=0 where id=v_offert;
  select * into v_res from respond_to_quote(v_offert,'accepted','PO-1');
  perform pg_temp.kolla(131, 'offert kan fortfarande accepteras och ger en order', 'ja',
    case when v_res.order_id is not null then 'ja' else 'nej' end);

  delete from orders where rfq_id = v_offert;
  delete from rfqs where id in (v_offert, v_order, v_tredje);
end $$;

-- ── DEL 12: checkoutens fält, och att de FRYSER ──────────────────────────
--
-- Kunden kunde beställa utan att någonsin ange vart varan skulle: formuläret
-- frågade efter namn, telefon och ett PO-nummer, inte efter leveransadress
-- eller om delleverans är okej. orders hade inga adressfält alls.
--
-- Kontroll 145 är den viktigaste: ordern bär en EGEN kopia. Flyttar kunden
-- efter att ordern lagts ska den gamla ordern fortfarande visa vart den
-- skickades -- §3 kräver en fryst kopia av det som gällde vid köpet.

do $$
declare
  v_p uuid; v_rfq uuid; v_ord uuid; v_o orders; v_fel text; v_res record;
  v_checkout jsonb := jsonb_build_object(
    'delivery_name','Godsmottagningen','delivery_street','Verkstadsgatan 4',
    'delivery_postal','582 54','delivery_city','Linköping','delivery_country','SE',
    'invoice_street','Box 12','invoice_postal','581 01','invoice_city','Linköping',
    'invoice_country','SE','invoice_email','faktura@example.invalid',
    'desired_delivery_date', (current_date + 21)::text,
    'delivery_instructions','Lastkaj B, ring 30 min innan',
    'delivery_mode','consolidated','customer_reference','Projekt Nord 2026');
begin
  select id into v_p from products where status='active' order by sku limit 1;

  begin
    perform submit_rfq('P','Kund','x@example.invalid','','','','','',
      jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',1)), '', 'order', '{}'::jsonb);
    v_fel := 'gick igenom';
  exception when others then v_fel := 'avvisad';
  end;
  perform pg_temp.kolla(132, 'beställning utan leveransadress avvisas', 'avvisad', v_fel);

  -- En offertförfrågan frågar bara om pris och ska inte kräva adress.
  begin
    perform submit_rfq('P','Kund','q@example.invalid','','','','','',
      jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',1)), '', 'quote', '{}'::jsonb);
    v_fel := 'gick igenom';
  exception when others then v_fel := 'avvisad';
  end;
  perform pg_temp.kolla(133, 'offertförfrågan kräver ingen adress', 'gick igenom', v_fel);

  begin
    perform submit_rfq('P','Kund','y@example.invalid','','','','','',
      jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',1)), '', 'order',
      v_checkout || jsonb_build_object('delivery_mode','kanske'));
    v_fel := 'gick igenom';
  exception when others then v_fel := 'avvisad';
  end;
  perform pg_temp.kolla(134, 'okänt leveranssätt avvisas', 'avvisad', v_fel);

  select submit_rfq('Beställning','Kund','k@example.invalid','070-1234567','Provbolaget','556000-0000','PO-9','',
    jsonb_build_array(jsonb_build_object('product_id', v_p::text,'qty',3)), '', 'order', v_checkout) into v_rfq;
  perform pg_temp.kolla(135, 'leveransadressen sparas', 'Verkstadsgatan 4',
    (select address_street from rfqs where id=v_rfq));
  perform pg_temp.kolla(136, 'fakturaadressen sparas separat', 'Box 12',
    (select invoice_street from rfqs where id=v_rfq));
  perform pg_temp.kolla(137, 'samlad leverans är kundens val', 'consolidated',
    (select delivery_mode from rfqs where id=v_rfq));

  update rfq_items set unit_price=100 where rfq_id=v_rfq;
  update rfqs set intent='quote', status='quoted', discount_pct=0 where id=v_rfq;
  select * into v_res from respond_to_quote(v_rfq,'accepted',null);
  v_ord := v_res.order_id;
  select * into v_o from orders where id=v_ord;

  perform pg_temp.kolla(138, 'ordern bär leveransadressen', 'Verkstadsgatan 4', v_o.delivery_street);
  perform pg_temp.kolla(139, 'ordern bär fakturaadressen', 'Box 12', v_o.invoice_street);
  perform pg_temp.kolla(140, 'ordern bär önskat leveransdatum', (current_date+21)::text, v_o.desired_delivery_date::text);
  perform pg_temp.kolla(141, 'ordern bär leveransinstruktionen', 'Lastkaj B, ring 30 min innan', v_o.delivery_instructions);
  perform pg_temp.kolla(142, 'ordern bär kundens interna referens', 'Projekt Nord 2026', v_o.customer_reference);
  perform pg_temp.kolla(143, 'ordern bär leveranssättet', 'consolidated', v_o.delivery_mode);
  perform pg_temp.kolla(144, 'ordern bär kontakttelefonen', '070-1234567', v_o.contact_phone);

  -- Adressen är FRYST.
  update rfqs set address_street='Nya gatan 99' where id=v_rfq;
  perform pg_temp.kolla(145, 'orderns adress ändras inte när förfrågan gör det', 'Verkstadsgatan 4',
    (select delivery_street from orders where id=v_ord));

  delete from orders where id=v_ord;
  delete from rfqs where contact_email like '%@example.invalid';
end $$;

select nr, kontroll, case when ok then 'OK' else 'FEL' end as utfall,
       case when ok then '' else 'väntade "' || coalesce(forvantat,'∅') || '", fick "' || coalesce(faktiskt,'∅') || '"' end as avvikelse
from prov_resultat order by nr;

-- Sammanfattningen sist, så den syns även i klienter som bara visar sista
-- satsens resultat.
select count(*) filter (where not ok) as antal_fel,
       count(*) as antal_kontroller,
       coalesce(string_agg(nr || ': ' || kontroll, ' | ') filter (where not ok), '—') as vilka_foll,
       case when count(*) filter (where not ok) = 0 then 'ALLA GRÖNA' else 'FEL FINNS' end as summa
from prov_resultat;
