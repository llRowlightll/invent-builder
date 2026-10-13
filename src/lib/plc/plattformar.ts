/**
 * Capability-registret: vad Maskinval kan göra för varje styrsystem.
 *
 * Fas 1 har ingen adapter ansluten. Därför är exportformat, versioner som
 * stöds, kodgenerering, kompilering och simulering tomma eller avstängda för
 * alla plattformar -- registret visar språk och kommunikation som hjälp när
 * kunden beskriver sitt system, men lovar inget stöd. Ett exportformat läggs
 * till först när importen provats i det riktiga verktyget (planen, fas 5).
 */

export interface PlattformsFormaga {
  id: string;
  tillverkare: string;
  /** Exempel på PLC-familjer, som hjälp vid ifyllning. */
  plcExempel: string[];
  miljo: string;
  /** IEC 61131-3-språken som de heter i miljön. */
  sprak: string[];
  kommunikation: string[];
  /** Versioner av miljön som en adapter stöder. Tom = ingen. */
  versionerSomStods: string[];
  /** Tillåtna bibliotek i genererad kod. Tom = ingen kod. */
  tillatnaBibliotek: string[];
  /** Exportformat som provats mot verktyget. Tom = ingen plattformsexport. */
  exportformat: string[];
  kodgenerering: boolean;
  kompilering: boolean;
  simulering: boolean;
  /** Begränsningen som kod; gränssnittet visar texten på kundens språk. */
  begransning: "ingen_adapter";
}

const formaga = (p: Pick<PlattformsFormaga, "id" | "tillverkare" | "plcExempel" | "miljo" | "sprak" | "kommunikation">): PlattformsFormaga => ({
  ...p,
  versionerSomStods: [],
  tillatnaBibliotek: [],
  exportformat: [],
  kodgenerering: false,
  kompilering: false,
  simulering: false,
  begransning: "ingen_adapter",
});

export const PLATTFORMAR: PlattformsFormaga[] = [
  formaga({ id: "siemens", tillverkare: "Siemens", plcExempel: ["S7-1200", "S7-1500", "ET 200SP CPU"], miljo: "TIA Portal",
    sprak: ["LAD", "FBD", "SCL", "GRAPH", "STL"], kommunikation: ["PROFINET", "PROFIBUS", "IO-Link"] }),
  formaga({ id: "rockwell", tillverkare: "Rockwell Automation", plcExempel: ["CompactLogix", "ControlLogix"], miljo: "Studio 5000 Logix Designer",
    sprak: ["LD", "FBD", "ST", "SFC"], kommunikation: ["EtherNet/IP", "IO-Link"] }),
  formaga({ id: "beckhoff", tillverkare: "Beckhoff", plcExempel: ["CX (inbyggd PC)", "C60xx (industri-PC)"], miljo: "TwinCAT 3",
    sprak: ["ST", "LD", "FBD", "SFC", "CFC"], kommunikation: ["EtherCAT", "PROFINET", "EtherNet/IP", "IO-Link"] }),
  formaga({ id: "codesys", tillverkare: "Codesys-baserad (t.ex. Festo CPX-E, Wago)", plcExempel: ["Festo CPX-E", "Wago PFC200"], miljo: "CODESYS V3.5",
    sprak: ["ST", "LD", "FBD", "SFC", "CFC"], kommunikation: ["EtherCAT", "PROFINET", "EtherNet/IP", "Modbus TCP", "IO-Link"] }),
  formaga({ id: "omron", tillverkare: "Omron", plcExempel: ["NX1P", "NJ"], miljo: "Sysmac Studio",
    sprak: ["LD", "ST"], kommunikation: ["EtherCAT", "EtherNet/IP", "IO-Link"] }),
  formaga({ id: "mitsubishi", tillverkare: "Mitsubishi Electric", plcExempel: ["iQ-R", "iQ-F"], miljo: "GX Works3",
    sprak: ["LD", "ST", "FBD/LD", "SFC"], kommunikation: ["CC-Link IE", "Modbus TCP"] }),
];

export function hittaPlattform(id: string): PlattformsFormaga | undefined {
  return PLATTFORMAR.find((p) => p.id === id);
}

/**
 * Vad som får göras med den angivna plattformen. Underlaget går alltid att
 * ta fram; plattformsexport och kod kräver en känd plattform OCH en adapter
 * som registret säger finns. Okänd plattform spärrar alltså kod, inte underlag.
 */
export function mojligheter(tillverkare: string): {
  underlag: true;
  plattformsexport: boolean;
  kod: boolean;
  orsak: "okand_plattform" | "ingen_adapter" | null;
} {
  const p = hittaPlattform(tillverkare);
  if (!p) return { underlag: true, plattformsexport: false, kod: false, orsak: "okand_plattform" };
  const plattformsexport = p.exportformat.length > 0;
  return { underlag: true, plattformsexport, kod: p.kodgenerering, orsak: plattformsexport || p.kodgenerering ? null : p.begransning };
}
