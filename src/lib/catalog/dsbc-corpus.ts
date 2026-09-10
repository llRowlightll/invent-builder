/**
 * FACIT: 455 lagerförda DSBC-orderkoder med Festos egna artikelnummer,
 * extraherade ur "Ordering data"-tabellerna i 202904_documentation.pdf
 * (utgåva 2026/09).
 *
 * Genererad fil -- redigera inte för hand. Kör scripts/extract-dsbc-corpus.py
 * mot en ny katalogutgåva istället.
 *
 * Testet dsbc.test.ts kräver att VARJE kod här parsar, validerar utan fel och
 * serialiseras tillbaka till exakt sig själv. Det är vad som gör modellen
 * bevisad istället för påstådd: driftar beställnyckeln failar bygget.
 */
export interface DsbcCorpusRow {
  part_no: string;
  code: string;
  bore_mm: number;
  stroke_mm: number;
}

export const DSBC_CORPUS: DsbcCorpusRow[] = [
  {
    "part_no": "3659374",
    "code": "DSBC-32-20-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 20
  },
  {
    "part_no": "3656511",
    "code": "DSBC-32-20-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 20
  },
  {
    "part_no": "2123085",
    "code": "DSBC-32-20-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 20
  },
  {
    "part_no": "2123069",
    "code": "DSBC-32-20-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 20
  },
  {
    "part_no": "3659375",
    "code": "DSBC-32-25-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 25
  },
  {
    "part_no": "3656512",
    "code": "DSBC-32-25-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 25
  },
  {
    "part_no": "1376467",
    "code": "DSBC-32-25-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 25
  },
  {
    "part_no": "1376422",
    "code": "DSBC-32-25-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 25
  },
  {
    "part_no": "3659376",
    "code": "DSBC-32-30-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 30
  },
  {
    "part_no": "3656513",
    "code": "DSBC-32-30-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 30
  },
  {
    "part_no": "2123086",
    "code": "DSBC-32-30-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 30
  },
  {
    "part_no": "2123070",
    "code": "DSBC-32-30-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 30
  },
  {
    "part_no": "3659377",
    "code": "DSBC-32-40-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 40
  },
  {
    "part_no": "3656514",
    "code": "DSBC-32-40-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 40
  },
  {
    "part_no": "1376468",
    "code": "DSBC-32-40-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 40
  },
  {
    "part_no": "1376423",
    "code": "DSBC-32-40-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 40
  },
  {
    "part_no": "3659378",
    "code": "DSBC-32-50-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 50
  },
  {
    "part_no": "3656515",
    "code": "DSBC-32-50-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 50
  },
  {
    "part_no": "1376469",
    "code": "DSBC-32-50-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 50
  },
  {
    "part_no": "1376424",
    "code": "DSBC-32-50-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 50
  },
  {
    "part_no": "3659379",
    "code": "DSBC-32-60-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 60
  },
  {
    "part_no": "3656516",
    "code": "DSBC-32-60-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 60
  },
  {
    "part_no": "2123087",
    "code": "DSBC-32-60-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 60
  },
  {
    "part_no": "2123071",
    "code": "DSBC-32-60-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 60
  },
  {
    "part_no": "3659380",
    "code": "DSBC-32-70-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 70
  },
  {
    "part_no": "3656517",
    "code": "DSBC-32-70-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 70
  },
  {
    "part_no": "2123088",
    "code": "DSBC-32-70-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 70
  },
  {
    "part_no": "2123072",
    "code": "DSBC-32-70-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 70
  },
  {
    "part_no": "3659381",
    "code": "DSBC-32-80-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 80
  },
  {
    "part_no": "3656518",
    "code": "DSBC-32-80-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 80
  },
  {
    "part_no": "1376470",
    "code": "DSBC-32-80-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 80
  },
  {
    "part_no": "1376425",
    "code": "DSBC-32-80-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 80
  },
  {
    "part_no": "3659382",
    "code": "DSBC-32-100-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 100
  },
  {
    "part_no": "3656519",
    "code": "DSBC-32-100-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 100
  },
  {
    "part_no": "1376471",
    "code": "DSBC-32-100-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 100
  },
  {
    "part_no": "1376426",
    "code": "DSBC-32-100-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 100
  },
  {
    "part_no": "3659383",
    "code": "DSBC-32-125-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 125
  },
  {
    "part_no": "3656520",
    "code": "DSBC-32-125-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 125
  },
  {
    "part_no": "1376472",
    "code": "DSBC-32-125-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 125
  },
  {
    "part_no": "1376427",
    "code": "DSBC-32-125-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 125
  },
  {
    "part_no": "3659384",
    "code": "DSBC-32-150-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 150
  },
  {
    "part_no": "3656521",
    "code": "DSBC-32-150-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 150
  },
  {
    "part_no": "2123089",
    "code": "DSBC-32-150-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 150
  },
  {
    "part_no": "2123073",
    "code": "DSBC-32-150-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 150
  },
  {
    "part_no": "3659385",
    "code": "DSBC-32-160-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 160
  },
  {
    "part_no": "3656522",
    "code": "DSBC-32-160-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 160
  },
  {
    "part_no": "1376473",
    "code": "DSBC-32-160-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 160
  },
  {
    "part_no": "1376428",
    "code": "DSBC-32-160-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 160
  },
  {
    "part_no": "3659386",
    "code": "DSBC-32-200-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 200
  },
  {
    "part_no": "3656523",
    "code": "DSBC-32-200-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 200
  },
  {
    "part_no": "1376474",
    "code": "DSBC-32-200-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 200
  },
  {
    "part_no": "1376429",
    "code": "DSBC-32-200-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 200
  },
  {
    "part_no": "3659387",
    "code": "DSBC-32-250-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 250
  },
  {
    "part_no": "3656524",
    "code": "DSBC-32-250-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 250
  },
  {
    "part_no": "1376475",
    "code": "DSBC-32-250-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 250
  },
  {
    "part_no": "1376430",
    "code": "DSBC-32-250-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 250
  },
  {
    "part_no": "3659388",
    "code": "DSBC-32-300-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 300
  },
  {
    "part_no": "3656525",
    "code": "DSBC-32-300-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 300
  },
  {
    "part_no": "2123090",
    "code": "DSBC-32-300-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 300
  },
  {
    "part_no": "2123074",
    "code": "DSBC-32-300-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 300
  },
  {
    "part_no": "3659389",
    "code": "DSBC-32-320-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 320
  },
  {
    "part_no": "3656526",
    "code": "DSBC-32-320-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 320
  },
  {
    "part_no": "1376476",
    "code": "DSBC-32-320-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 320
  },
  {
    "part_no": "1376431",
    "code": "DSBC-32-320-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 320
  },
  {
    "part_no": "8165446",
    "code": "DSBC-32-400-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 400
  },
  {
    "part_no": "8165440",
    "code": "DSBC-32-400-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 400
  },
  {
    "part_no": "1376477",
    "code": "DSBC-32-400-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 400
  },
  {
    "part_no": "1376432",
    "code": "DSBC-32-400-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 400
  },
  {
    "part_no": "8165461",
    "code": "DSBC-32-500-D3-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 500
  },
  {
    "part_no": "8165460",
    "code": "DSBC-32-500-D3-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 500
  },
  {
    "part_no": "1376478",
    "code": "DSBC-32-500-PPSA-N3",
    "bore_mm": 32,
    "stroke_mm": 500
  },
  {
    "part_no": "1376433",
    "code": "DSBC-32-500-PPVA-N3",
    "bore_mm": 32,
    "stroke_mm": 500
  },
  {
    "part_no": "3660759",
    "code": "DSBC-40-20-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 20
  },
  {
    "part_no": "3660615",
    "code": "DSBC-40-20-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 20
  },
  {
    "part_no": "2123780",
    "code": "DSBC-40-20-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 20
  },
  {
    "part_no": "2123166",
    "code": "DSBC-40-20-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 20
  },
  {
    "part_no": "3660760",
    "code": "DSBC-40-25-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 25
  },
  {
    "part_no": "3660616",
    "code": "DSBC-40-25-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 25
  },
  {
    "part_no": "1376903",
    "code": "DSBC-40-25-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 25
  },
  {
    "part_no": "1376656",
    "code": "DSBC-40-25-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 25
  },
  {
    "part_no": "3660761",
    "code": "DSBC-40-30-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 30
  },
  {
    "part_no": "3660617",
    "code": "DSBC-40-30-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 30
  },
  {
    "part_no": "2123781",
    "code": "DSBC-40-30-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 30
  },
  {
    "part_no": "2123167",
    "code": "DSBC-40-30-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 30
  },
  {
    "part_no": "3660762",
    "code": "DSBC-40-40-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 40
  },
  {
    "part_no": "3660618",
    "code": "DSBC-40-40-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 40
  },
  {
    "part_no": "1376904",
    "code": "DSBC-40-40-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 40
  },
  {
    "part_no": "1376657",
    "code": "DSBC-40-40-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 40
  },
  {
    "part_no": "3660763",
    "code": "DSBC-40-50-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 50
  },
  {
    "part_no": "3660619",
    "code": "DSBC-40-50-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 50
  },
  {
    "part_no": "1376905",
    "code": "DSBC-40-50-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 50
  },
  {
    "part_no": "1376658",
    "code": "DSBC-40-50-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 50
  },
  {
    "part_no": "3660764",
    "code": "DSBC-40-60-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 60
  },
  {
    "part_no": "3660620",
    "code": "DSBC-40-60-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 60
  },
  {
    "part_no": "2123782",
    "code": "DSBC-40-60-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 60
  },
  {
    "part_no": "2123224",
    "code": "DSBC-40-60-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 60
  },
  {
    "part_no": "3660765",
    "code": "DSBC-40-70-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 70
  },
  {
    "part_no": "3660621",
    "code": "DSBC-40-70-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 70
  },
  {
    "part_no": "2123783",
    "code": "DSBC-40-70-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 70
  },
  {
    "part_no": "2123225",
    "code": "DSBC-40-70-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 70
  },
  {
    "part_no": "3660766",
    "code": "DSBC-40-80-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 80
  },
  {
    "part_no": "3660622",
    "code": "DSBC-40-80-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 80
  },
  {
    "part_no": "1376906",
    "code": "DSBC-40-80-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 80
  },
  {
    "part_no": "1376659",
    "code": "DSBC-40-80-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 80
  },
  {
    "part_no": "3660767",
    "code": "DSBC-40-100-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 100
  },
  {
    "part_no": "3660623",
    "code": "DSBC-40-100-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 100
  },
  {
    "part_no": "1376907",
    "code": "DSBC-40-100-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 100
  },
  {
    "part_no": "1376660",
    "code": "DSBC-40-100-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 100
  },
  {
    "part_no": "3660768",
    "code": "DSBC-40-125-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 125
  },
  {
    "part_no": "3660624",
    "code": "DSBC-40-125-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 125
  },
  {
    "part_no": "1376908",
    "code": "DSBC-40-125-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 125
  },
  {
    "part_no": "1376661",
    "code": "DSBC-40-125-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 125
  },
  {
    "part_no": "3660769",
    "code": "DSBC-40-150-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 150
  },
  {
    "part_no": "3660625",
    "code": "DSBC-40-150-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 150
  },
  {
    "part_no": "2123784",
    "code": "DSBC-40-150-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 150
  },
  {
    "part_no": "2123226",
    "code": "DSBC-40-150-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 150
  },
  {
    "part_no": "3660770",
    "code": "DSBC-40-160-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 160
  },
  {
    "part_no": "3660626",
    "code": "DSBC-40-160-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 160
  },
  {
    "part_no": "1376909",
    "code": "DSBC-40-160-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 160
  },
  {
    "part_no": "1376662",
    "code": "DSBC-40-160-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 160
  },
  {
    "part_no": "3660771",
    "code": "DSBC-40-200-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 200
  },
  {
    "part_no": "3660627",
    "code": "DSBC-40-200-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 200
  },
  {
    "part_no": "1376910",
    "code": "DSBC-40-200-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 200
  },
  {
    "part_no": "1376663",
    "code": "DSBC-40-200-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 200
  },
  {
    "part_no": "3660772",
    "code": "DSBC-40-250-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 250
  },
  {
    "part_no": "3660628",
    "code": "DSBC-40-250-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 250
  },
  {
    "part_no": "1376911",
    "code": "DSBC-40-250-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 250
  },
  {
    "part_no": "1376664",
    "code": "DSBC-40-250-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 250
  },
  {
    "part_no": "3660773",
    "code": "DSBC-40-300-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 300
  },
  {
    "part_no": "3660629",
    "code": "DSBC-40-300-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 300
  },
  {
    "part_no": "2123785",
    "code": "DSBC-40-300-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 300
  },
  {
    "part_no": "2123227",
    "code": "DSBC-40-300-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 300
  },
  {
    "part_no": "3660774",
    "code": "DSBC-40-320-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 320
  },
  {
    "part_no": "3660630",
    "code": "DSBC-40-320-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 320
  },
  {
    "part_no": "1376912",
    "code": "DSBC-40-320-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 320
  },
  {
    "part_no": "1376665",
    "code": "DSBC-40-320-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 320
  },
  {
    "part_no": "8165583",
    "code": "DSBC-40-400-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 400
  },
  {
    "part_no": "8165582",
    "code": "DSBC-40-400-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 400
  },
  {
    "part_no": "1376913",
    "code": "DSBC-40-400-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 400
  },
  {
    "part_no": "1376666",
    "code": "DSBC-40-400-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 400
  },
  {
    "part_no": "8165586",
    "code": "DSBC-40-500-D3-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 500
  },
  {
    "part_no": "8165584",
    "code": "DSBC-40-500-D3-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 500
  },
  {
    "part_no": "1376914",
    "code": "DSBC-40-500-PPSA-N3",
    "bore_mm": 40,
    "stroke_mm": 500
  },
  {
    "part_no": "1376667",
    "code": "DSBC-40-500-PPVA-N3",
    "bore_mm": 40,
    "stroke_mm": 500
  },
  {
    "part_no": "3659491",
    "code": "DSBC-50-20-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 20
  },
  {
    "part_no": "3659467",
    "code": "DSBC-50-20-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 20
  },
  {
    "part_no": "2102628",
    "code": "DSBC-50-20-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 20
  },
  {
    "part_no": "2098969",
    "code": "DSBC-50-20-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 20
  },
  {
    "part_no": "3659492",
    "code": "DSBC-50-25-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 25
  },
  {
    "part_no": "3659468",
    "code": "DSBC-50-25-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 25
  },
  {
    "part_no": "1376301",
    "code": "DSBC-50-25-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 25
  },
  {
    "part_no": "1366948",
    "code": "DSBC-50-25-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 25
  },
  {
    "part_no": "3659493",
    "code": "DSBC-50-30-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 30
  },
  {
    "part_no": "3659469",
    "code": "DSBC-50-30-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 30
  },
  {
    "part_no": "2102629",
    "code": "DSBC-50-30-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 30
  },
  {
    "part_no": "2098970",
    "code": "DSBC-50-30-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 30
  },
  {
    "part_no": "3659494",
    "code": "DSBC-50-40-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 40
  },
  {
    "part_no": "3659470",
    "code": "DSBC-50-40-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 40
  },
  {
    "part_no": "1376304",
    "code": "DSBC-50-40-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 40
  },
  {
    "part_no": "1366949",
    "code": "DSBC-50-40-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 40
  },
  {
    "part_no": "3659495",
    "code": "DSBC-50-50-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 50
  },
  {
    "part_no": "3659471",
    "code": "DSBC-50-50-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 50
  },
  {
    "part_no": "1376305",
    "code": "DSBC-50-50-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 50
  },
  {
    "part_no": "1366950",
    "code": "DSBC-50-50-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 50
  },
  {
    "part_no": "3659496",
    "code": "DSBC-50-60-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 60
  },
  {
    "part_no": "3659472",
    "code": "DSBC-50-60-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 60
  },
  {
    "part_no": "2102630",
    "code": "DSBC-50-60-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 60
  },
  {
    "part_no": "2098972",
    "code": "DSBC-50-60-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 60
  },
  {
    "part_no": "3659497",
    "code": "DSBC-50-70-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 70
  },
  {
    "part_no": "3659473",
    "code": "DSBC-50-70-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 70
  },
  {
    "part_no": "2102631",
    "code": "DSBC-50-70-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 70
  },
  {
    "part_no": "2098973",
    "code": "DSBC-50-70-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 70
  },
  {
    "part_no": "3659498",
    "code": "DSBC-50-80-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 80
  },
  {
    "part_no": "3659474",
    "code": "DSBC-50-80-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 80
  },
  {
    "part_no": "1376306",
    "code": "DSBC-50-80-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 80
  },
  {
    "part_no": "1366951",
    "code": "DSBC-50-80-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 80
  },
  {
    "part_no": "3659499",
    "code": "DSBC-50-100-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 100
  },
  {
    "part_no": "3659475",
    "code": "DSBC-50-100-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 100
  },
  {
    "part_no": "1376307",
    "code": "DSBC-50-100-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 100
  },
  {
    "part_no": "1366952",
    "code": "DSBC-50-100-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 100
  },
  {
    "part_no": "3659500",
    "code": "DSBC-50-125-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 125
  },
  {
    "part_no": "3659476",
    "code": "DSBC-50-125-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 125
  },
  {
    "part_no": "1376308",
    "code": "DSBC-50-125-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 125
  },
  {
    "part_no": "1366953",
    "code": "DSBC-50-125-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 125
  },
  {
    "part_no": "3659501",
    "code": "DSBC-50-150-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 150
  },
  {
    "part_no": "3659477",
    "code": "DSBC-50-150-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 150
  },
  {
    "part_no": "2102632",
    "code": "DSBC-50-150-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 150
  },
  {
    "part_no": "2098974",
    "code": "DSBC-50-150-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 150
  },
  {
    "part_no": "3659502",
    "code": "DSBC-50-160-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 160
  },
  {
    "part_no": "3659478",
    "code": "DSBC-50-160-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 160
  },
  {
    "part_no": "1376309",
    "code": "DSBC-50-160-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 160
  },
  {
    "part_no": "1366954",
    "code": "DSBC-50-160-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 160
  },
  {
    "part_no": "3659503",
    "code": "DSBC-50-200-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 200
  },
  {
    "part_no": "3659479",
    "code": "DSBC-50-200-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 200
  },
  {
    "part_no": "1376310",
    "code": "DSBC-50-200-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 200
  },
  {
    "part_no": "1366955",
    "code": "DSBC-50-200-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 200
  },
  {
    "part_no": "3659504",
    "code": "DSBC-50-250-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 250
  },
  {
    "part_no": "3659480",
    "code": "DSBC-50-250-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 250
  },
  {
    "part_no": "1376311",
    "code": "DSBC-50-250-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 250
  },
  {
    "part_no": "1366956",
    "code": "DSBC-50-250-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 250
  },
  {
    "part_no": "3659505",
    "code": "DSBC-50-300-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 300
  },
  {
    "part_no": "3659481",
    "code": "DSBC-50-300-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 300
  },
  {
    "part_no": "2102633",
    "code": "DSBC-50-300-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 300
  },
  {
    "part_no": "2098975",
    "code": "DSBC-50-300-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 300
  },
  {
    "part_no": "3659506",
    "code": "DSBC-50-320-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 320
  },
  {
    "part_no": "3659482",
    "code": "DSBC-50-320-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 320
  },
  {
    "part_no": "1376312",
    "code": "DSBC-50-320-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 320
  },
  {
    "part_no": "1366957",
    "code": "DSBC-50-320-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 320
  },
  {
    "part_no": "8165588",
    "code": "DSBC-50-400-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 400
  },
  {
    "part_no": "8165587",
    "code": "DSBC-50-400-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 400
  },
  {
    "part_no": "1376313",
    "code": "DSBC-50-400-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 400
  },
  {
    "part_no": "1366958",
    "code": "DSBC-50-400-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 400
  },
  {
    "part_no": "8165590",
    "code": "DSBC-50-500-D3-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 500
  },
  {
    "part_no": "8165589",
    "code": "DSBC-50-500-D3-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 500
  },
  {
    "part_no": "1376314",
    "code": "DSBC-50-500-PPSA-N3",
    "bore_mm": 50,
    "stroke_mm": 500
  },
  {
    "part_no": "1366959",
    "code": "DSBC-50-500-PPVA-N3",
    "bore_mm": 50,
    "stroke_mm": 500
  },
  {
    "part_no": "3657811",
    "code": "DSBC-63-20-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 20
  },
  {
    "part_no": "3657859",
    "code": "DSBC-63-20-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 20
  },
  {
    "part_no": "2126684",
    "code": "DSBC-63-20-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 20
  },
  {
    "part_no": "2125490",
    "code": "DSBC-63-20-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 20
  },
  {
    "part_no": "3657812",
    "code": "DSBC-63-25-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 25
  },
  {
    "part_no": "3657860",
    "code": "DSBC-63-25-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 25
  },
  {
    "part_no": "1383632",
    "code": "DSBC-63-25-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 25
  },
  {
    "part_no": "1383578",
    "code": "DSBC-63-25-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 25
  },
  {
    "part_no": "3657813",
    "code": "DSBC-63-30-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 30
  },
  {
    "part_no": "3657861",
    "code": "DSBC-63-30-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 30
  },
  {
    "part_no": "2126685",
    "code": "DSBC-63-30-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 30
  },
  {
    "part_no": "2125491",
    "code": "DSBC-63-30-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 30
  },
  {
    "part_no": "3657814",
    "code": "DSBC-63-40-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 40
  },
  {
    "part_no": "3657862",
    "code": "DSBC-63-40-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 40
  },
  {
    "part_no": "1383633",
    "code": "DSBC-63-40-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 40
  },
  {
    "part_no": "1383579",
    "code": "DSBC-63-40-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 40
  },
  {
    "part_no": "3657815",
    "code": "DSBC-63-50-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 50
  },
  {
    "part_no": "3657863",
    "code": "DSBC-63-50-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 50
  },
  {
    "part_no": "1383634",
    "code": "DSBC-63-50-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 50
  },
  {
    "part_no": "1383580",
    "code": "DSBC-63-50-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 50
  },
  {
    "part_no": "3657816",
    "code": "DSBC-63-60-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 60
  },
  {
    "part_no": "3657864",
    "code": "DSBC-63-60-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 60
  },
  {
    "part_no": "2126686",
    "code": "DSBC-63-60-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 60
  },
  {
    "part_no": "2125492",
    "code": "DSBC-63-60-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 60
  },
  {
    "part_no": "3657817",
    "code": "DSBC-63-70-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 70
  },
  {
    "part_no": "3657865",
    "code": "DSBC-63-70-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 70
  },
  {
    "part_no": "2126687",
    "code": "DSBC-63-70-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 70
  },
  {
    "part_no": "2125493",
    "code": "DSBC-63-70-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 70
  },
  {
    "part_no": "3657818",
    "code": "DSBC-63-80-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 80
  },
  {
    "part_no": "3657866",
    "code": "DSBC-63-80-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 80
  },
  {
    "part_no": "1383635",
    "code": "DSBC-63-80-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 80
  },
  {
    "part_no": "1383581",
    "code": "DSBC-63-80-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 80
  },
  {
    "part_no": "3657819",
    "code": "DSBC-63-100-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 100
  },
  {
    "part_no": "3657867",
    "code": "DSBC-63-100-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 100
  },
  {
    "part_no": "1383636",
    "code": "DSBC-63-100-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 100
  },
  {
    "part_no": "1383582",
    "code": "DSBC-63-100-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 100
  },
  {
    "part_no": "3657820",
    "code": "DSBC-63-125-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 125
  },
  {
    "part_no": "3657868",
    "code": "DSBC-63-125-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 125
  },
  {
    "part_no": "1383637",
    "code": "DSBC-63-125-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 125
  },
  {
    "part_no": "1383583",
    "code": "DSBC-63-125-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 125
  },
  {
    "part_no": "3657821",
    "code": "DSBC-63-150-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 150
  },
  {
    "part_no": "3657869",
    "code": "DSBC-63-150-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 150
  },
  {
    "part_no": "2126688",
    "code": "DSBC-63-150-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 150
  },
  {
    "part_no": "2125494",
    "code": "DSBC-63-150-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 150
  },
  {
    "part_no": "3657822",
    "code": "DSBC-63-160-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 160
  },
  {
    "part_no": "3657870",
    "code": "DSBC-63-160-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 160
  },
  {
    "part_no": "1383638",
    "code": "DSBC-63-160-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 160
  },
  {
    "part_no": "1383584",
    "code": "DSBC-63-160-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 160
  },
  {
    "part_no": "3657823",
    "code": "DSBC-63-200-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 200
  },
  {
    "part_no": "3657871",
    "code": "DSBC-63-200-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 200
  },
  {
    "part_no": "1383639",
    "code": "DSBC-63-200-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 200
  },
  {
    "part_no": "1383585",
    "code": "DSBC-63-200-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 200
  },
  {
    "part_no": "3657824",
    "code": "DSBC-63-250-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 250
  },
  {
    "part_no": "3657872",
    "code": "DSBC-63-250-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 250
  },
  {
    "part_no": "1383640",
    "code": "DSBC-63-250-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 250
  },
  {
    "part_no": "1383586",
    "code": "DSBC-63-250-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 250
  },
  {
    "part_no": "3657825",
    "code": "DSBC-63-300-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 300
  },
  {
    "part_no": "3657873",
    "code": "DSBC-63-300-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 300
  },
  {
    "part_no": "2126689",
    "code": "DSBC-63-300-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 300
  },
  {
    "part_no": "2125495",
    "code": "DSBC-63-300-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 300
  },
  {
    "part_no": "3657826",
    "code": "DSBC-63-320-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 320
  },
  {
    "part_no": "3657874",
    "code": "DSBC-63-320-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 320
  },
  {
    "part_no": "1383641",
    "code": "DSBC-63-320-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 320
  },
  {
    "part_no": "1383587",
    "code": "DSBC-63-320-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 320
  },
  {
    "part_no": "8165592",
    "code": "DSBC-63-400-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 400
  },
  {
    "part_no": "8165591",
    "code": "DSBC-63-400-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 400
  },
  {
    "part_no": "1383642",
    "code": "DSBC-63-400-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 400
  },
  {
    "part_no": "1383588",
    "code": "DSBC-63-400-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 400
  },
  {
    "part_no": "8165594",
    "code": "DSBC-63-500-D3-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 500
  },
  {
    "part_no": "8165593",
    "code": "DSBC-63-500-D3-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 500
  },
  {
    "part_no": "1383643",
    "code": "DSBC-63-500-PPSA-N3",
    "bore_mm": 63,
    "stroke_mm": 500
  },
  {
    "part_no": "1383589",
    "code": "DSBC-63-500-PPVA-N3",
    "bore_mm": 63,
    "stroke_mm": 500
  },
  {
    "part_no": "3656854",
    "code": "DSBC-80-20-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 20
  },
  {
    "part_no": "3656631",
    "code": "DSBC-80-20-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 20
  },
  {
    "part_no": "2126636",
    "code": "DSBC-80-20-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 20
  },
  {
    "part_no": "2126594",
    "code": "DSBC-80-20-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 20
  },
  {
    "part_no": "3656855",
    "code": "DSBC-80-25-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 25
  },
  {
    "part_no": "3656632",
    "code": "DSBC-80-25-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 25
  },
  {
    "part_no": "1383366",
    "code": "DSBC-80-25-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 25
  },
  {
    "part_no": "1383333",
    "code": "DSBC-80-25-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 25
  },
  {
    "part_no": "3656856",
    "code": "DSBC-80-30-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 30
  },
  {
    "part_no": "3656633",
    "code": "DSBC-80-30-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 30
  },
  {
    "part_no": "2126637",
    "code": "DSBC-80-30-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 30
  },
  {
    "part_no": "2126595",
    "code": "DSBC-80-30-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 30
  },
  {
    "part_no": "3656857",
    "code": "DSBC-80-40-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 40
  },
  {
    "part_no": "3656634",
    "code": "DSBC-80-40-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 40
  },
  {
    "part_no": "1383367",
    "code": "DSBC-80-40-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 40
  },
  {
    "part_no": "1383334",
    "code": "DSBC-80-40-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 40
  },
  {
    "part_no": "3656858",
    "code": "DSBC-80-50-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 50
  },
  {
    "part_no": "3656635",
    "code": "DSBC-80-50-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 50
  },
  {
    "part_no": "1383368",
    "code": "DSBC-80-50-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 50
  },
  {
    "part_no": "1383335",
    "code": "DSBC-80-50-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 50
  },
  {
    "part_no": "3656859",
    "code": "DSBC-80-60-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 60
  },
  {
    "part_no": "3656636",
    "code": "DSBC-80-60-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 60
  },
  {
    "part_no": "2126638",
    "code": "DSBC-80-60-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 60
  },
  {
    "part_no": "2126597",
    "code": "DSBC-80-60-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 60
  },
  {
    "part_no": "3656860",
    "code": "DSBC-80-70-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 70
  },
  {
    "part_no": "3656637",
    "code": "DSBC-80-70-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 70
  },
  {
    "part_no": "2126639",
    "code": "DSBC-80-70-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 70
  },
  {
    "part_no": "2126598",
    "code": "DSBC-80-70-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 70
  },
  {
    "part_no": "3656861",
    "code": "DSBC-80-80-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 80
  },
  {
    "part_no": "3656638",
    "code": "DSBC-80-80-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 80
  },
  {
    "part_no": "1383369",
    "code": "DSBC-80-80-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 80
  },
  {
    "part_no": "1383336",
    "code": "DSBC-80-80-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 80
  },
  {
    "part_no": "3656862",
    "code": "DSBC-80-100-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 100
  },
  {
    "part_no": "3656639",
    "code": "DSBC-80-100-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 100
  },
  {
    "part_no": "1383370",
    "code": "DSBC-80-100-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 100
  },
  {
    "part_no": "1383337",
    "code": "DSBC-80-100-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 100
  },
  {
    "part_no": "3656863",
    "code": "DSBC-80-125-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 125
  },
  {
    "part_no": "3656640",
    "code": "DSBC-80-125-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 125
  },
  {
    "part_no": "1383371",
    "code": "DSBC-80-125-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 125
  },
  {
    "part_no": "1383338",
    "code": "DSBC-80-125-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 125
  },
  {
    "part_no": "3656864",
    "code": "DSBC-80-150-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 150
  },
  {
    "part_no": "3656641",
    "code": "DSBC-80-150-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 150
  },
  {
    "part_no": "2126640",
    "code": "DSBC-80-150-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 150
  },
  {
    "part_no": "2126599",
    "code": "DSBC-80-150-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 150
  },
  {
    "part_no": "3656865",
    "code": "DSBC-80-160-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 160
  },
  {
    "part_no": "3656642",
    "code": "DSBC-80-160-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 160
  },
  {
    "part_no": "1383372",
    "code": "DSBC-80-160-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 160
  },
  {
    "part_no": "1383339",
    "code": "DSBC-80-160-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 160
  },
  {
    "part_no": "3656866",
    "code": "DSBC-80-200-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 200
  },
  {
    "part_no": "3656643",
    "code": "DSBC-80-200-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 200
  },
  {
    "part_no": "1383373",
    "code": "DSBC-80-200-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 200
  },
  {
    "part_no": "1383340",
    "code": "DSBC-80-200-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 200
  },
  {
    "part_no": "3656867",
    "code": "DSBC-80-250-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 250
  },
  {
    "part_no": "3656644",
    "code": "DSBC-80-250-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 250
  },
  {
    "part_no": "1383374",
    "code": "DSBC-80-250-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 250
  },
  {
    "part_no": "1383341",
    "code": "DSBC-80-250-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 250
  },
  {
    "part_no": "3656868",
    "code": "DSBC-80-300-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 300
  },
  {
    "part_no": "3656645",
    "code": "DSBC-80-300-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 300
  },
  {
    "part_no": "2126641",
    "code": "DSBC-80-300-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 300
  },
  {
    "part_no": "2126600",
    "code": "DSBC-80-300-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 300
  },
  {
    "part_no": "3656869",
    "code": "DSBC-80-320-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 320
  },
  {
    "part_no": "3656646",
    "code": "DSBC-80-320-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 320
  },
  {
    "part_no": "1383375",
    "code": "DSBC-80-320-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 320
  },
  {
    "part_no": "1383342",
    "code": "DSBC-80-320-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 320
  },
  {
    "part_no": "8165596",
    "code": "DSBC-80-400-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 400
  },
  {
    "part_no": "8165595",
    "code": "DSBC-80-400-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 400
  },
  {
    "part_no": "1383376",
    "code": "DSBC-80-400-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 400
  },
  {
    "part_no": "1383343",
    "code": "DSBC-80-400-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 400
  },
  {
    "part_no": "8165598",
    "code": "DSBC-80-500-D3-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 500
  },
  {
    "part_no": "8165597",
    "code": "DSBC-80-500-D3-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 500
  },
  {
    "part_no": "1383377",
    "code": "DSBC-80-500-PPSA-N3",
    "bore_mm": 80,
    "stroke_mm": 500
  },
  {
    "part_no": "1383344",
    "code": "DSBC-80-500-PPVA-N3",
    "bore_mm": 80,
    "stroke_mm": 500
  },
  {
    "part_no": "8165693",
    "code": "DSBC-100-25-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 25
  },
  {
    "part_no": "8165653",
    "code": "DSBC-100-25-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 25
  },
  {
    "part_no": "1384890",
    "code": "DSBC-100-25-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 25
  },
  {
    "part_no": "1384804",
    "code": "DSBC-100-25-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 25
  },
  {
    "part_no": "8165690",
    "code": "DSBC-100-40-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 40
  },
  {
    "part_no": "8165656",
    "code": "DSBC-100-40-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 40
  },
  {
    "part_no": "1384891",
    "code": "DSBC-100-40-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 40
  },
  {
    "part_no": "1384805",
    "code": "DSBC-100-40-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 40
  },
  {
    "part_no": "8165695",
    "code": "DSBC-100-50-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 50
  },
  {
    "part_no": "8165658",
    "code": "DSBC-100-50-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 50
  },
  {
    "part_no": "1384892",
    "code": "DSBC-100-50-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 50
  },
  {
    "part_no": "1384806",
    "code": "DSBC-100-50-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 50
  },
  {
    "part_no": "8165697",
    "code": "DSBC-100-80-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 80
  },
  {
    "part_no": "8165660",
    "code": "DSBC-100-80-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 80
  },
  {
    "part_no": "1384893",
    "code": "DSBC-100-80-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 80
  },
  {
    "part_no": "1384807",
    "code": "DSBC-100-80-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 80
  },
  {
    "part_no": "8165689",
    "code": "DSBC-100-100-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 100
  },
  {
    "part_no": "8165649",
    "code": "DSBC-100-100-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 100
  },
  {
    "part_no": "1384894",
    "code": "DSBC-100-100-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 100
  },
  {
    "part_no": "1384808",
    "code": "DSBC-100-100-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 100
  },
  {
    "part_no": "8165694",
    "code": "DSBC-100-125-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 125
  },
  {
    "part_no": "8165650",
    "code": "DSBC-100-125-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 125
  },
  {
    "part_no": "1384895",
    "code": "DSBC-100-125-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 125
  },
  {
    "part_no": "1384809",
    "code": "DSBC-100-125-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 125
  },
  {
    "part_no": "8165686",
    "code": "DSBC-100-160-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 160
  },
  {
    "part_no": "8165651",
    "code": "DSBC-100-160-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 160
  },
  {
    "part_no": "1384896",
    "code": "DSBC-100-160-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 160
  },
  {
    "part_no": "1384810",
    "code": "DSBC-100-160-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 160
  },
  {
    "part_no": "8165688",
    "code": "DSBC-100-200-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 200
  },
  {
    "part_no": "8165652",
    "code": "DSBC-100-200-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 200
  },
  {
    "part_no": "1384897",
    "code": "DSBC-100-200-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 200
  },
  {
    "part_no": "1384811",
    "code": "DSBC-100-200-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 200
  },
  {
    "part_no": "8165691",
    "code": "DSBC-100-250-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 250
  },
  {
    "part_no": "8165654",
    "code": "DSBC-100-250-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 250
  },
  {
    "part_no": "1384898",
    "code": "DSBC-100-250-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 250
  },
  {
    "part_no": "1384812",
    "code": "DSBC-100-250-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 250
  },
  {
    "part_no": "8165696",
    "code": "DSBC-100-320-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 320
  },
  {
    "part_no": "8165655",
    "code": "DSBC-100-320-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 320
  },
  {
    "part_no": "1384899",
    "code": "DSBC-100-320-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 320
  },
  {
    "part_no": "1384813",
    "code": "DSBC-100-320-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 320
  },
  {
    "part_no": "8165692",
    "code": "DSBC-100-400-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 400
  },
  {
    "part_no": "8165657",
    "code": "DSBC-100-400-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 400
  },
  {
    "part_no": "1384900",
    "code": "DSBC-100-400-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 400
  },
  {
    "part_no": "1384814",
    "code": "DSBC-100-400-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 400
  },
  {
    "part_no": "8165687",
    "code": "DSBC-100-500-D3-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 500
  },
  {
    "part_no": "8165659",
    "code": "DSBC-100-500-D3-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 500
  },
  {
    "part_no": "1384901",
    "code": "DSBC-100-500-PPSA-N3",
    "bore_mm": 100,
    "stroke_mm": 500
  },
  {
    "part_no": "1384815",
    "code": "DSBC-100-500-PPVA-N3",
    "bore_mm": 100,
    "stroke_mm": 500
  },
  {
    "part_no": "8165669",
    "code": "DSBC-125-25-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 25
  },
  {
    "part_no": "8165670",
    "code": "DSBC-125-25-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 25
  },
  {
    "part_no": "1804956",
    "code": "DSBC-125-25-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 25
  },
  {
    "part_no": "8165675",
    "code": "DSBC-125-40-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 40
  },
  {
    "part_no": "8165676",
    "code": "DSBC-125-40-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 40
  },
  {
    "part_no": "1804662",
    "code": "DSBC-125-40-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 40
  },
  {
    "part_no": "1804957",
    "code": "DSBC-125-40-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 40
  },
  {
    "part_no": "8165679",
    "code": "DSBC-125-50-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 50
  },
  {
    "part_no": "8165680",
    "code": "DSBC-125-50-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 50
  },
  {
    "part_no": "1804663",
    "code": "DSBC-125-50-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 50
  },
  {
    "part_no": "1804958",
    "code": "DSBC-125-50-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 50
  },
  {
    "part_no": "8165683",
    "code": "DSBC-125-80-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 80
  },
  {
    "part_no": "8165684",
    "code": "DSBC-125-80-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 80
  },
  {
    "part_no": "1804664",
    "code": "DSBC-125-80-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 80
  },
  {
    "part_no": "1804959",
    "code": "DSBC-125-80-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 80
  },
  {
    "part_no": "8165661",
    "code": "DSBC-125-100-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 100
  },
  {
    "part_no": "8165662",
    "code": "DSBC-125-100-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 100
  },
  {
    "part_no": "1804665",
    "code": "DSBC-125-100-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 100
  },
  {
    "part_no": "1804960",
    "code": "DSBC-125-100-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 100
  },
  {
    "part_no": "8165663",
    "code": "DSBC-125-125-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 125
  },
  {
    "part_no": "8165664",
    "code": "DSBC-125-125-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 125
  },
  {
    "part_no": "1804666",
    "code": "DSBC-125-125-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 125
  },
  {
    "part_no": "1804961",
    "code": "DSBC-125-125-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 125
  },
  {
    "part_no": "8165665",
    "code": "DSBC-125-160-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 160
  },
  {
    "part_no": "8165666",
    "code": "DSBC-125-160-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 160
  },
  {
    "part_no": "1804667",
    "code": "DSBC-125-160-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 160
  },
  {
    "part_no": "1804962",
    "code": "DSBC-125-160-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 160
  },
  {
    "part_no": "8165667",
    "code": "DSBC-125-200-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 200
  },
  {
    "part_no": "8165668",
    "code": "DSBC-125-200-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 200
  },
  {
    "part_no": "1804668",
    "code": "DSBC-125-200-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 200
  },
  {
    "part_no": "1804963",
    "code": "DSBC-125-200-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 200
  },
  {
    "part_no": "8165671",
    "code": "DSBC-125-250-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 250
  },
  {
    "part_no": "8165672",
    "code": "DSBC-125-250-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 250
  },
  {
    "part_no": "1804669",
    "code": "DSBC-125-250-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 250
  },
  {
    "part_no": "1804964",
    "code": "DSBC-125-250-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 250
  },
  {
    "part_no": "8165673",
    "code": "DSBC-125-320-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 320
  },
  {
    "part_no": "8165674",
    "code": "DSBC-125-320-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 320
  },
  {
    "part_no": "1804671",
    "code": "DSBC-125-320-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 320
  },
  {
    "part_no": "1804965",
    "code": "DSBC-125-320-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 320
  },
  {
    "part_no": "8165677",
    "code": "DSBC-125-400-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 400
  },
  {
    "part_no": "8165678",
    "code": "DSBC-125-400-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 400
  },
  {
    "part_no": "1804672",
    "code": "DSBC-125-400-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 400
  },
  {
    "part_no": "1804966",
    "code": "DSBC-125-400-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 400
  },
  {
    "part_no": "8165681",
    "code": "DSBC-125-500-D3-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 500
  },
  {
    "part_no": "8165682",
    "code": "DSBC-125-500-D3-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 500
  },
  {
    "part_no": "1804673",
    "code": "DSBC-125-500-PPSA-N3",
    "bore_mm": 125,
    "stroke_mm": 500
  },
  {
    "part_no": "1804967",
    "code": "DSBC-125-500-PPVA-N3",
    "bore_mm": 125,
    "stroke_mm": 500
  }
];
