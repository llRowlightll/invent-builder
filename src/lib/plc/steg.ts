/**
 * PLC-underlagets åtta steg, och vilka som finns. En lista för projektsidan
 * och gästvyn (plc.index.tsx), så att ingen sida beskriver ett steg som
 * färdigt när det inte är det (brief 2026-10-14: "Visa inte en funktion som
 * färdig om den inte är implementerad").
 */
export const STEG: Array<{ nr: number; sv: string; en: string; finns: boolean; innehallSv: string; innehallEn: string }> = [
  { nr: 1, sv: "Omfattning", en: "Scope", finns: true,
    innehallSv: "Kraven från maskinprojektet eller den befintliga maskinen, med ursprung, och vad underlaget ska omfatta.",
    innehallEn: "The requirements from the machine project or the existing machine, with their origin, and what the documentation should cover." },
  { nr: 2, sv: "Plattform", en: "Platform", finns: true,
    innehallSv: "Styrsystemet och varför: fabrikens standard, service och reservdelar.",
    innehallEn: "The control platform and why: the plant standard, service and spare parts." },
  { nr: 3, sv: "Funktion och driftlägen", en: "Function and modes", finns: false,
    innehallSv: "Funktionen med egna ord, start- och slutvillkor och operatörens uppgifter. Driftlägen och tillstånd enligt PackML (ISA-TR88.00.02).",
    innehallEn: "The function in plain words, start and end conditions and the operator's tasks. Modes and states per PackML (ISA-TR88.00.02)." },
  { nr: 4, sv: "Signaler och parametrar", en: "Signals and parameters", finns: false,
    innehallSv: "I/O-listan härleds ur stycklistan, med beteckningar enligt IEC 81346 (t.ex. -BG1, -QM1). Parametrar med enhet och gränser.",
    innehallEn: "The I/O list is derived from the bill of materials, with designations per IEC 81346 (e.g. -BG1, -QM1). Parameters with units and limits." },
  { nr: 5, sv: "Sekvens", en: "Sequence", finns: false,
    innehallSv: "Steg och övergångar som lista och GRAFCET-vy (IEC 60848), med poster för spänningsbortfall, kommunikationsbortfall och återstart.",
    innehallEn: "Steps and transitions as a list and a GRAFCET view (IEC 60848), with entries for power loss, communication loss and restart." },
  { nr: 6, sv: "Larm", en: "Alarms", finns: false,
    innehallSv: "Larm med orsak, konsekvens, åtgärd och tid att agera, prioriterade enligt ISA-18.2.",
    innehallEn: "Alarms with cause, consequence, action and time to respond, prioritised per ISA-18.2." },
  { nr: 7, sv: "Test", en: "Test", finns: false,
    innehallSv: "FAT/SAT-protokoll (IEC 62381): I/O-kontroll per signal, test per sekvenssteg och larmtest. Allt står som Ej utfört tills det provats på riktig utrustning.",
    innehallEn: "FAT/SAT protocol (IEC 62381): I/O check per signal, test per sequence step and alarm test. Everything stays Not performed until tested on real equipment." },
  { nr: 8, sv: "Leverans", en: "Delivery", finns: false,
    innehallSv: "Statustavla, export som Markdown, CSV och JSON, och förfrågan om hjälp av automationsingenjör.",
    innehallEn: "Status board, export as Markdown, CSV and JSON, and a request for help from an automation engineer." },
];
