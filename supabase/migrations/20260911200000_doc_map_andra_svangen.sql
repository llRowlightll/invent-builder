-- Andra svängen efter familjer som saknade dokument.
--
-- FYRA UTAN NEDLADDNING: CPV10, EGC, GPR och HLR täcks av dokument som redan
-- var inlästa. Verifierat mot innehållet med krav på att MÄRKET stämmer --
-- CPV10 har 76 träffar i CPV-katalogen, EGC 65 i EGC-BS-KF, GPR 6 i Parkers
-- gripdonskatalog, och HLR står som egen rubrik ("HLR Rodless Actuators").
--
-- TOLV NYA FILER: SMC:s manualer bär "CD"-prefix och kortare serienamn än våra
-- familjeslugar, vilket första sökningen missade. Nu finns CJ2, CJP, CP96,
-- CY1R, MGPM och den RIKTIGA MHZ2-manualen (inte robotgripenheten JMHZ2).
-- Plus Festos MPA-katalog, verifierad: rubriken är "Valve terminal MPA-S"
-- med 681 träffar på MPA/VMPA.
--
-- AVVISAT I SAMMA SVEP. Festos API faller tillbaka på systerserier när
-- familjen inte finns, och det hade blivit tysta fel:
--   DGPL -> DGO          annan produkt
--   JMFH -> VUVG         annan ventilserie
--   VUVB -> VUVG         närbesläktad, inte samma
--   C85  -> om_cg1x      en CG1-manual
--   MPA  -> VTSA         träffarna var enheten "0.8 MPA", megapascal
--   DGPL -> adaptrar     bara en kompatibilitetslista, "DGPL/EHPS"

insert into knowledge_doc_families (source_file, family_slug, doc_title) values
 ('203780_documentation.pdf','cpv10','Festo — Valve terminal CPV, Compact Performance'),
 ('202969_documentation.pdf','egc','Festo — Ball screw axes EGC-BS-KF'),
 ('1900-2_Gripper-Catalog.pdf','gpr','Parker — Pneumatic Grippers'),
 ('parker-electromechanical.pdf','hlr','Parker — Electromechanical Overview'),
 ('smc-cj2-om_cj2-z_om0067p_en.pdf','cj2','SMC — CJ2 driftmanual'),
 ('smc-cjp-om_cjp-z_om0207qen.pdf','cjp','SMC — CJP driftmanual'),
 ('smc-cjp-om_cjp2_om0002k_en.pdf','cjp','SMC — CJP2 driftmanual'),
 ('smc-cp96-om_cp96n_om0197qen.pdf','cp96','SMC — CP96N driftmanual'),
 ('smc-cp96-om_cp96x-c_om0002qen.pdf','cp96','SMC — CP96X-C driftmanual'),
 ('smc-cp96-om_cp96x_mm0049qen.pdf','cp96','SMC — CP96X driftmanual'),
 ('smc-cy1r-om_cy1f_om0002f_en.pdf','cy1r','SMC — CY1F (CY1-serien)'),
 ('smc-cy1r-om_cy1l_om0002c_en.pdf','cy1r','SMC — CY1L (CY1-serien)'),
 ('smc-cy1r-om_cy1s-z_om0078p_en.pdf','cy1r','SMC — CY1S (CY1-serien)'),
 ('smc-mgpm-om_mgp-z_mgpx-om0047pen-b.pdf','mgpm','SMC — MGP-serien driftmanual'),
 ('smc-mhz2-om_mhz2_omd0047en-a.pdf','mhz2','SMC — MHZ2 driftmanual'),
 ('festo-VMPA-TYP32-203792.pdf','mpa','Festo — Valve terminal MPA-S')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;
