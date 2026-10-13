/**
 * Stegens lägen i ett flöde (maskinbyggaren, PLC-underlaget). Egen modul utan
 * React, så att lägena kan räknas och provas utanför webbläsaren.
 *   aktivt   -- steget som visas
 *   klart    -- genomfört
 *   saknas   -- genomfört, men uppgifter saknas
 *   konflikt -- något uppfyller inte kravet eller motsäger ett annat
 *   last     -- inte tillgängligt än
 *   ny       -- tillgängligt men inte påbörjat (neutralt, inget fel)
 */
export type StegTillstand = "aktivt" | "klart" | "saknas" | "konflikt" | "last" | "ny";
