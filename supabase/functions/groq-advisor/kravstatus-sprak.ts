/**
 * Kravstatusen på tyska och spanska.
 *
 * Raderna byggs med `sv ? svenska : engelska` i index.ts, kontroller.ts,
 * griporgan.ts och komponentkrav.ts, så de- och es-besökare fick dem på
 * engelska ("force 59 N (preliminary estimate)", kontrollkörningen mot drift
 * 2026-11-18). Här översätts den engelska formen efteråt, mönster för mönster.
 * En text delas vid "; " och varje del översätts för sig. Känns en del inte
 * igen står den kvar på engelska, som förut.
 *
 * Ändras en engelsk form i någon av filerna ovan ska mönstret här följa med;
 * testet i kravstatus-sprak.test.ts täcker formerna.
 */
type Mall = [RegExp, string, string];

const MALLAR: Mall[] = [
  // ── Krav ──
  [/^force (.+) N \(preliminary estimate\)$/, "Kraft $1 N (vorläufige Schätzung)", "fuerza $1 N (estimación preliminar)"],
  [/^force (.+) N$/, "Kraft $1 N", "fuerza $1 N"],
  [/^stroke\/travel (.+) mm$/, "Hub/Weg $1 mm", "carrera/recorrido $1 mm"],
  [/^precision ±(.+) mm$/, "Genauigkeit ±$1 mm", "precisión ±$1 mm"],
  [/^pusher speed$/, "Geschwindigkeit des Ausschiebers", "velocidad del expulsor"],
  [/^environment \((.+)\)$/, "Umgebung ($1)", "entorno ($1)"],
  [/^standard (.+)$/, "Norm $1", "norma $1"],
  [/^pressure (.+) bar$/, "Druck $1 bar", "presión $1 bar"],
  [/^grip force$/, "Greifkraft", "fuerza de agarre"],
  [/^grip force ≈ (.+) N \(rule of thumb: weight × 100 for a friction grip\)$/, "Greifkraft ≈ $1 N (Faustregel: Gewicht × 100 bei Reibgriff)", "fuerza de agarre ≈ $1 N (regla práctica: peso × 100 para agarre por fricción)"],
  [/^grip force ≈ (.+) N \(rule of thumb: weight × 100$/, "Greifkraft ≈ $1 N (Faustregel: Gewicht × 100", "fuerza de agarre ≈ $1 N (regla práctica: peso × 100"],
  [/^the stated holding force (.+) N is lower\)$/, "die angegebene Haltekraft $1 N ist niedriger)", "la fuerza de sujeción indicada de $1 N es menor)"],
  [/^grip force (.+) N$/, "Greifkraft $1 N", "fuerza de agarre $1 N"],
  [/^IP rating (.+)$/, "Schutzart $1", "grado de protección $1"],
  [/^temperature (.+) °C$/, "Temperatur $1 °C", "temperatura $1 °C"],
  [/^food\/washdown$/, "Lebensmittel/Reinigung", "alimentos/lavado"],
  [/^holding force$/, "Haltekraft", "fuerza de sujeción"],
  [/^holding force ≈ (.+) N \(weight × 9\.81 × 2\)$/, "Haltekraft ≈ $1 N (Gewicht × 9,81 × 2)", "fuerza de sujeción ≈ $1 N (peso × 9,81 × 2)"],
  [/^holding force ≈ (.+) N \(weight × \(9\.81 \+ 3\/0\.5\) × 2: lift plus 3 m\/s² lateral acceleration, friction 0\.5\)$/, "Haltekraft ≈ $1 N (Gewicht × (9,81 + 3/0,5) × 2: Heben plus 3 m/s² Querbeschleunigung, Reibung 0,5)", "fuerza de sujeción ≈ $1 N (peso × (9,81 + 3/0,5) × 2: elevación más 3 m/s² de aceleración lateral, fricción 0,5)"],
  [/^holding force (.+) N$/, "Haltekraft $1 N", "fuerza de sujeción $1 N"],
  [/^energy ≈ (.+) J per cycle$/, "Energie ≈ $1 J pro Hub", "energía ≈ $1 J por ciclo"],
  [/^fieldbus (.+)$/, "Feldbus $1", "bus de campo $1"],
  [/^(\d+) valve stations$/, "$1 Ventilplätze", "$1 posiciones de válvula"],
  // ── Utfallstexter ──
  [/^the option gives (.+) N$/, "die Option liefert $1 N", "la opción da $1 N"],
  [/^the option's force is unknown$/, "die Kraft der Option ist unbekannt", "se desconoce la fuerza de la opción"],
  [/^the stroke is chosen at order$/, "der Hub wird bei der Bestellung gewählt", "la carrera se elige al hacer el pedido"],
  [/^the option has (.+) mm$/, "die Option hat $1 mm", "la opción tiene $1 mm"],
  [/^the travel must be limited or confirmed$/, "der Weg muss begrenzt oder bestätigt werden", "el recorrido debe limitarse o confirmarse"],
  [/^repeatability ±(.+) mm according to the catalogue$/, "Wiederholgenauigkeit ±$1 mm laut Katalog", "repetibilidad ±$1 mm según el catálogo"],
  [/^a pneumatic cylinder only stops precisely at its end positions$/, "ein Pneumatikzylinder hält nur in seinen Endlagen genau an", "un cilindro neumático solo se detiene con precisión en sus posiciones finales"],
  [/^the catalogue gives no repeatability for the option$/, "der Katalog nennt keine Wiederholgenauigkeit für die Option", "el catálogo no indica la repetibilidad de la opción"],
  [/^not stated -- the conveyor speed is not the pusher's$/, "nicht angegeben – die Bandgeschwindigkeit ist nicht die des Ausschiebers", "no indicada: la velocidad de la cinta no es la del expulsor"],
  [/^no automatic check$/, "keine automatische Prüfung", "sin comprobación automática"],
  [/^the option is a (.+) with its own mounting, not an (.+) cylinder$/, "die Option ist eine eigene Einheit ($1) mit eigener Befestigung, kein $2-Zylinder", "la opción es una unidad propia ($1) con fijación propia, no un cilindro $2"],
  [/^the option's standard is not stated$/, "die Norm der Option ist nicht angegeben", "no se indica la norma de la opción"],
  [/^the option is (.+)$/, "die Option ist $1", "la opción es $1"],
  [/^the catalogue gives no pressure for the item$/, "der Katalog nennt keinen Druck für den Artikel", "el catálogo no indica la presión del artículo"],
  [/^the item is only rated up to (.+) °C$/, "der Artikel ist nur bis $1 °C ausgelegt", "el artículo solo está especificado hasta $1 °C"],
  [/^the item is rated up to (.+) °C$/, "der Artikel ist bis $1 °C ausgelegt", "el artículo está especificado hasta $1 °C"],
  [/^the item is only rated (.+)$/, "der Artikel ist nur für $1 ausgelegt", "el artículo solo está especificado para $1"],
  [/^the item is rated (.+)$/, "der Artikel ist für $1 ausgelegt", "el artículo está especificado para $1"],
  [/^the item requires (.+)$/, "der Artikel erfordert $1", "el artículo requiere $1"],
  [/^neither the load's mass nor the grip force is stated$/, "weder die Masse der Last noch die Greifkraft ist angegeben", "no se indica ni la masa de la carga ni la fuerza de agarre"],
  [/^neither the load's mass nor the holding force is stated$/, "weder die Masse der Last noch die Haltekraft ist angegeben", "no se indica ni la masa de la carga ni la fuerza de sujeción"],
  [/^the catalogue gives no grip force for the item$/, "der Katalog nennt keine Greifkraft für den Artikel", "el catálogo no indica la fuerza de agarre del artículo"],
  [/^the stated force is below the friction-grip rule of thumb \(≈ (.+) N\) and only suffices with a form-fit grip$/, "die angegebene Kraft liegt unter der Faustregel für Reibgriff (≈ $1 N) und reicht nur bei formschlüssigem Griff", "la fuerza indicada está por debajo de la regla práctica para agarre por fricción (≈ $1 N) y solo basta con un agarre por forma"],
  [/^the series gives ≈ (.+) N in its largest size$/, "die Serie liefert ≈ $1 N in der größten Größe", "la serie da ≈ $1 N en su tamaño mayor"],
  [/^the item gives ≈ (.+) N$/, "der Artikel liefert ≈ $1 N", "el artículo da ≈ $1 N"],
  [/^choose the size that gives at least (.+) N$/, "die Größe wählen, die mindestens $1 N liefert", "elegir el tamaño que dé al menos $1 N"],
  [/^the catalogue gives no voltage for the item$/, "der Katalog nennt keine Spannung für den Artikel", "el catálogo no indica la tensión del artículo"],
  [/^the item is specified for (.+)$/, "der Artikel ist für $1 angegeben", "el artículo está especificado para $1"],
  [/^the catalogue gives no IP rating for the item$/, "der Katalog nennt keine Schutzart für den Artikel", "el catálogo no indica el grado de protección del artículo"],
  [/^the requirement could not be read$/, "die Anforderung konnte nicht gelesen werden", "no se pudo leer el requisito"],
  [/^the catalogue gives no maximum temperature for the item$/, "der Katalog nennt keine Höchsttemperatur für den Artikel", "el catálogo no indica la temperatura máxima del artículo"],
  [/^standard seals are made for about 80 °C, so verify a high-temperature version$/, "Standarddichtungen sind für etwa 80 °C ausgelegt – eine Hochtemperaturausführung prüfen", "las juntas estándar están hechas para unos 80 °C: verifique una versión para alta temperatura"],
  [/^ATEX-marked according to the catalogue$/, "laut Katalog ATEX-gekennzeichnet", "con marcado ATEX según el catálogo"],
  [/^no ATEX marking in the catalogue$/, "keine ATEX-Kennzeichnung im Katalog", "sin marcado ATEX en el catálogo"],
  [/^must not be used in the zone without a certificate$/, "darf ohne Zertifikat nicht in der Zone eingesetzt werden", "no debe usarse en la zona sin certificado"],
  [/^washdown-rated according to the catalogue$/, "laut Katalog für Nassreinigung ausgelegt", "apto para lavado según el catálogo"],
  [/^food approval is confirmed in the quote$/, "die Lebensmittelzulassung wird im Angebot bestätigt", "la aprobación alimentaria se confirma en la oferta"],
  [/^the catalogue states no IP rating, stainless version or food approval for the item$/, "der Katalog nennt weder Schutzart, Edelstahlausführung noch Lebensmittelzulassung für den Artikel", "el catálogo no indica grado de protección, versión inoxidable ni aprobación alimentaria del artículo"],
  [/^verify before purchase$/, "vor dem Kauf prüfen", "verificar antes de comprar"],
  [/^the cup's holding force is unknown$/, "die Haltekraft des Saugers ist unbekannt", "se desconoce la fuerza de sujeción de la ventosa"],
  [/^one cup gives ≈ (.+) N \(estimate\)$/, "ein Sauger liefert ≈ $1 N (Schätzung)", "una ventosa da ≈ $1 N (estimación)"],
  [/^one cup gives ≈ (.+) N$/, "ein Sauger liefert ≈ $1 N", "una ventosa da ≈ $1 N"],
  [/^≈ (.+) cups are needed \(estimate\)$/, "≈ $1 Sauger werden benötigt (Schätzung)", "se necesitan ≈ $1 ventosas (estimación)"],
  [/^≈ (.+) cups would be needed, so choose a larger cup \(estimate\)$/, "≈ $1 Sauger wären nötig – einen größeren Sauger wählen (Schätzung)", "harían falta ≈ $1 ventosas: elija una ventosa mayor (estimación)"],
  [/^the catalogue gives no energy capacity for the absorber$/, "der Katalog nennt keine Energieaufnahme für den Dämpfer", "el catálogo no indica la capacidad energética del amortiguador"],
  [/^the absorber only takes (.+) J per cycle$/, "der Dämpfer nimmt nur $1 J pro Hub auf", "el amortiguador solo absorbe $1 J por ciclo"],
  [/^the absorber takes (.+) J per cycle$/, "der Dämpfer nimmt $1 J pro Hub auf", "el amortiguador absorbe $1 J por ciclo"],
  [/^the catalogue gives no fieldbus for the item$/, "der Katalog nennt keinen Feldbus für den Artikel", "el catálogo no indica el bus de campo del artículo"],
  [/^the item is available for (.+)$/, "der Artikel ist für $1 erhältlich", "el artículo está disponible para $1"],
  [/^the catalogue does not give the number of valve stations$/, "der Katalog nennt die Anzahl der Ventilplätze nicht", "el catálogo no indica el número de posiciones de válvula"],
  [/^the terminal has up to (.+) stations$/, "die Ventilinsel hat bis zu $1 Plätze", "el terminal tiene hasta $1 posiciones"],
  [/^the terminal only has (.+) stations$/, "die Ventilinsel hat nur $1 Plätze", "el terminal solo tiene $1 posiciones"],
];

/** Decimalkomma i tal ("3.1 N" → "3,1 N"), inte i t.ex. "ISO 15552". */
const komma = (s: string) => s.replace(/(\d)\.(\d)/g, "$1,$2");

function delPaSprak(del: string, locale: "de" | "es"): string {
  for (const [re, de, es] of MALLAR) {
    if (re.test(del)) return komma(del.replace(re, locale === "de" ? de : es));
  }
  return del;
}

/** En kravstatustext på tyska eller spanska; på andra språk orörd. */
export function kravtextPaSprak(text: string, locale: string): string {
  if (locale !== "de" && locale !== "es") return text;
  return String(text ?? "").split("; ").map((d) => delPaSprak(d, locale)).join("; ");
}

/** Kravstatusen i alternativen på besökarens språk (de/es), annars orörd. */
export function kravstatusPaSprak<T extends { kravstatus?: unknown }>(alternativ: T[], locale: string): T[] {
  if (locale !== "de" && locale !== "es") return alternativ;
  return alternativ.map((o) => {
    const ks = o.kravstatus;
    if (!Array.isArray(ks) || !ks.length) return o;
    return {
      ...o,
      kravstatus: ks.map((r: { krav?: string; text?: string }) => ({
        ...r,
        krav: kravtextPaSprak(r.krav ?? "", locale),
        text: kravtextPaSprak(r.text ?? "", locale),
      })),
    };
  });
}
