-- SMC:s driftmanualer kopplade till familjer.
--
-- SMC publicerar INGA kataloger med beställnyckel på webben -- bara
-- driftmanualer. De bär tekniska data, mått och underhållsanvisningar, vilket
-- räcker för kunskapssökningen, men ger inte orderkodens grammatik. SMC kan
-- därför inte få samma djupmodell som DSBC utan att katalogerna begärs via
-- återförsäljarkontakt.
--
-- SÖKORDET ÄR INTE DOKUMENTETS FAMILJ. SMC:s sökning returnerar löst
-- besläktade träffar, och en mappning på sökordet hade gett:
--   "om_cm2y..."      hittad under CQ2  -> är en CM2
--   "om_ex600-axx..." hittad under MB   -> är en fältbussmodul
--   "om_idg-x017..."  hittad under MB   -> är en membrantork
--   "om_jmhz2..."     hittad under MHZ2 -> är en robotgripenhet, annan produkt
-- Varje fil är därför kontrollerad mot dokumentets EGEN serie i filnamnet.
-- Tio filer är uttryckligen bortvalda; de handlar om andra produkter.
insert into knowledge_doc_families (source_file, family_slug, doc_title) values
 ('smc-CM2-om_cm2-az1_om0261qen.pdf','cm2','SMC — CM2 driftmanual'),
 ('smc-CM2-om_cm2-z_om0064p_en.pdf','cm2','SMC — CM2 driftmanual'),
 ('smc-CM2-om_cm2_om0081p_en.pdf','cm2','SMC — CM2 driftmanual'),
 ('smc-CM2-om_cm2_om0300qen.pdf','cm2','SMC — CM2 driftmanual'),
 ('smc-CQ2-om_cdq2eb_om0288q_en.pdf','cq2','SMC — CQ2 driftmanual'),
 ('smc-CQ2-om_cm2y_om0001hen.pdf','cm2','SMC — CQ2 driftmanual'),
 ('smc-CQ2-om_cq2-x3423_om0295qen.pdf','cq2','SMC — CQ2 driftmanual'),
 ('smc-CQ2-om_cq2x_om0002m-en.pdf','cq2','SMC — CQ2 driftmanual'),
 ('smc-CS1-cs1_om0004f_gb.pdf','cs1','SMC — CS1 driftmanual'),
 ('smc-EX500-om_ex500-gdn1_devicenet_en.pdf','ex500','SMC — EX500 driftmanual'),
 ('smc-EX500-om_ex500-gen1_ethernetip_en-a.pdf','ex500','SMC — EX500 driftmanual'),
 ('smc-EX500-om_ex500-gen2_ethernetip_en-b.pdf','ex500','SMC — EX500 driftmanual'),
 ('smc-EX500-om_ex500-gpn2_profinet_en-a.pdf','ex500','SMC — EX500 driftmanual'),
 ('smc-LESH-om_lesh_stepdc_en.pdf','lesh','SMC — LESH driftmanual'),
 ('smc-LEY-om_hf2a-ley_doc1069086en.pdf','ley','SMC — LEY driftmanual'),
 ('smc-LEY-om_le2y_le2yg_doc1068298en.pdf','ley','SMC — LEY driftmanual'),
 ('smc-LEY-om_ley_leyg_battery-less_stepdc_en.pdf','ley','SMC — LEY driftmanual'),
 ('smc-LEY-om_ley_leyg_omz0015en.pdf','ley','SMC — LEY driftmanual'),
 ('smc-MGPL-om_mgpl-z_om0242qen.pdf','mgpl','SMC — MGPL driftmanual'),
 ('smc-MHC2-om_mhc2_omg0048en.pdf','mhc2','SMC — MHC2 driftmanual'),
 ('smc-MHC2-om_mhc2_omg0120en.pdf','mhc2','SMC — MHC2 driftmanual'),
 ('smc-MXS-om_mxs-x2578_doc1082441en.pdf','mxs','SMC — MXS driftmanual'),
 ('smc-MXS-om_mxs_omg0114en.pdf','mxs','SMC — MXS driftmanual'),
 ('smc-SV1000-om_sv1000_2000_3000_4000_ome0002en-c.pdf','sv1000','SMC — SV1000 driftmanual'),
 ('smc-SY3000-om_25a-jsy_omz0002en-c.pdf','sy3000','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_25a-jsy_omz0002en-c.pdf','sy','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_25a-jsy_omz0004en-c.pdf','sy3000','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_25a-jsy_omz0004en-c.pdf','sy','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_jsy1000v_omw0002en-e.pdf','sy3000','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_jsy1000v_omw0002en-e.pdf','sy','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_jsy1000v_omw0004en-c.pdf','sy3000','SMC — SY3000 driftmanual'),
 ('smc-SY3000-om_jsy1000v_omw0004en-c.pdf','sy','SMC — SY3000 driftmanual'),
 ('smc-VF3000-om_vf1000_3000_5000-omn0002en-a.pdf','vf3000','SMC — VF3000 driftmanual'),
 ('smc-VQ1000-om_vq1000-2000_vq1000v-omm0002en-b.pdf.pdf','vq1000','SMC — VQ1000 driftmanual'),
 ('smc-VQ1000-om_vq1000-2000_vq1000v-omm0002en-b.pdf.pdf','vq','SMC — VQ1000 driftmanual'),
 ('smc-ZH-om_zhp_om00201en.pdf','zh','SMC — ZH driftmanual')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;
