"""Gör tests/fixtures/prislista-prov.xlsx: en påhittad prislista i den form
leverantörer brukar skicka (titelrad, RS-kolumner, AVENTICS-nummer som Excel
gjort till ett tal, förpackning). Inga riktiga priser."""
import openpyxl, pathlib
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Prislista"
ws.append(["Prislista november 2026 (prov)"])
ws.append([])
ws.append(["RS Stock No.", "Mfr. Part No.", "Description", "Pack Size", "Price (SEK)"])
ws.append(["123-4567", "RB0806", "Shock absorber M8", 1, 412])
ws.append(["222-3333", 822123009, "AVENTICS cylinder", 1, 1890.5])
ws.append(["111-2222", "QS-1/2-10", "Fitting, pack of 10", 10, 289])
ut = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "prislista-prov.xlsx"
wb.save(ut)
print(ut)
