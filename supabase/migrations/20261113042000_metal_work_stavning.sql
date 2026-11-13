-- "Metal Works" stod i åtta beskrivningar; fabrikatet heter Metal Work
-- (kundgranskningen 2026-11-13).
update products set description = replace(description, 'Metal Works', 'Metal Work') where description like '%Metal Works%';
