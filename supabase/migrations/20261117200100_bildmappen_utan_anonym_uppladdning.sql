-- "temp allow anon upload" lät vem som helst ladda upp filer i product-images.
-- Bildfunktionen (generate-product-images) laddar upp med servernyckeln och
-- behöver den inte; ingen kod på sajten laddar upp dit.
drop policy if exists "temp allow anon upload" on storage.objects;
