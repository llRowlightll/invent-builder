/// <reference lib="deno.ns" />
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { provaGripkraft, provaSpanning, provaTemperatur, provaTryck, tolkaSpanningar, tolkaTryckBar } from "./kontroller.ts";

Deno.test("tryck i katalogens format läses som bar", () => {
  assertEquals(tolkaTryckBar("10"), { min: null, max: 10 });
  assertEquals(tolkaTryckBar("10.3 bar"), { min: null, max: 10.3 });
  assertEquals(tolkaTryckBar("3–7 bar"), { min: 3, max: 7 });
  assertEquals(tolkaTryckBar("-0.9–10 bar"), { min: -0.9, max: 10 });
  assertEquals(tolkaTryckBar("0.1–0.7 MPa"), { min: 1, max: 7 });
  assertEquals(tolkaTryckBar("0…−101 kPa")?.max, 0);
  assertEquals(tolkaTryckBar(""), null);
  assertEquals(tolkaTryckBar(undefined), null);
});

Deno.test("spänningar i katalogens format", () => {
  assertEquals(tolkaSpanningar("24 V DC"), [{ volt: 24, typ: "DC" }]);
  assertEquals(tolkaSpanningar("24 VDC / 100 VAC"), [{ volt: 24, typ: "DC" }, { volt: 100, typ: "AC" }]);
  assertEquals(tolkaSpanningar("24 VDC ±10 %"), [{ volt: 24, typ: "DC" }]);
  assertEquals(tolkaSpanningar("200 VAC"), [{ volt: 200, typ: "AC" }]);
});

Deno.test("trycket prövas mot artikeln, och saknad uppgift är underlag som saknas", () => {
  assertEquals(provaTryck(6, { max_pressure: "10 bar" }, true).utfall, "uppfyllt");
  assertEquals(provaTryck(6, { operating_pressure: "1–10 bar" }, true).text, "artikeln klarar 1–10 bar");
  assertEquals(provaTryck(8, { operating_pressure: "3–7 bar" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaTryck(2, { operating_pressure: "3–7 bar" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaTryck(6, { operating_pressure: "-0.9–10 bar" }, true).utfall, "uppfyllt");
  assertEquals(provaTryck(6, {}, true).utfall, "underlag_saknas");
  assertEquals(provaTryck(6, { operating_pressure: "0.1–0.7 MPa" }, true).utfall, "uppfyllt");
});

Deno.test("spänningen prövas mot artikeln", () => {
  const dc24 = { volt: 24, typ: "DC" as const };
  assertEquals(provaSpanning(dc24, { voltage: "24 V DC" }, true).utfall, "uppfyllt");
  assertEquals(provaSpanning(dc24, { voltage: "24 VDC / 100 VAC" }, true).utfall, "uppfyllt");
  assertEquals(provaSpanning(dc24, { voltage: "200 VAC" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaSpanning(dc24, {}, true).utfall, "underlag_saknas");
});

Deno.test("spolspänningen räknas som artikelns spänning (ventiler och ventilterminaler)", () => {
  // 41 ventiler och ventilterminaler har spänningen under solenoid_voltage
  // och fick "katalogen anger ingen spänning" (2026-11-17).
  const dc24 = { volt: 24, typ: "DC" as const };
  assertEquals(provaSpanning(dc24, { solenoid_voltage: "24 VDC" }, true).utfall, "uppfyllt");
  assertEquals(provaSpanning(dc24, { solenoid_voltage: "24 VAC 50/60 Hz" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaSpanning(dc24, { nominal_voltage: "24 V DC" }, true).utfall, "uppfyllt");
  // voltage går före, och ett tomt fält hoppas över.
  assertEquals(provaSpanning(dc24, { voltage: "", solenoid_voltage: "24 VDC" }, true).utfall, "uppfyllt");
  assertEquals(provaSpanning(dc24, { voltage: "200 VAC", solenoid_voltage: "24 VDC" }, true).utfall, "ej_uppfyllt");
  // En spole som beställs separat är inte artikelns egen spänning.
  assertEquals(provaSpanning(dc24, { coil_voltage_ordered_separately: "24 VDC" }, true).utfall, "underlag_saknas");
});

Deno.test("gripkraften prövas mot kravet; utan uppgift saknas underlag", () => {
  const tumregel = { n: 5000, angiven: false, tumregelN: 5000, angivetN: 0 };
  const angiven = { n: 100, angiven: true, tumregelN: 0, angivetN: 100 };
  assertEquals(provaGripkraft(tumregel, 170, true).utfall, "ej_uppfyllt");
  assertEquals(provaGripkraft(tumregel, 170, true).text, "artikeln ger ≈ 170 N");
  assert(/tumregel/.test(provaGripkraft(tumregel, 170, true).krav));
  assertEquals(provaGripkraft(angiven, 170, true).utfall, "uppfyllt");
  assertEquals(provaGripkraft(angiven, 170, true).krav, "gripkraft 100 N");
  assertEquals(provaGripkraft(angiven, 0, true).utfall, "underlag_saknas");
});

// Granskningen 2026-10-14: ett gripdon utan krav att pröva mot var grönt på
// trycket, och en angiven kraft under tumregeln gällde utan ett ord.
Deno.test("gripkraft utan krav saknar underlag; en angiven kraft under tumregeln sägs ut", () => {
  const ingen = provaGripkraft({ n: 0, angiven: false, tumregelN: 0, angivetN: 0 }, 600, true);
  assertEquals([ingen.utfall, ingen.text], ["underlag_saknas", "varken lastens massa eller gripkraften är angiven"]);
  const lag = provaGripkraft({ n: 600, angiven: true, tumregelN: 5000, angivetN: 600 }, 800, true);
  assertEquals(lag.utfall, "uppfyllt");
  assert(/lägre än tumregeln för friktionsgrepp \(≈ 5000 N\) och räcker bara med formgrepp/.test(lag.text), lag.text);
  const hall = provaGripkraft({ n: 5000, angiven: false, tumregelN: 5000, angivetN: 200 }, 508, true);
  assertEquals(hall.utfall, "ej_uppfyllt");
  assert(/den angivna hållkraften 200 N är lägre/.test(hall.krav), hall.krav);
  const serie = provaGripkraft({ n: 5000, angiven: false, tumregelN: 5000, angivetN: 0 }, 6300, true, true);
  assertEquals([serie.utfall, serie.text], ["uppfyllt", "serien ger ≈ 6300 N i största storleken"]);
});

Deno.test("kapslingsklass: IP69K kräver 69K, IPxx jämförs siffra för siffra (kundgranskning 2026-11-13)", async () => {
  const { provaIp } = await import("./kontroller.ts");
  assertEquals(provaIp("IP69K", { ip_rating: "IP65" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaIp("IP69K", { ip_rating: "IP67" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaIp("IP69K", { ip_rating: "IP65/IP67/IP69K" }, true).utfall, "uppfyllt");
  assertEquals(provaIp("IP65", { ip_rating: "IP67" }, true).utfall, "uppfyllt");
  assertEquals(provaIp("IP67", { ip_rating: "IP65" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaIp("IP69K", {}, true).utfall, "underlag_saknas");
});

Deno.test("temperatur: okänd gräns sägs, känd prövas", () => {
  const okand = provaTemperatur(180, {}, true);
  assertEquals(okand.utfall, "underlag_saknas");
  assert(/80 °C/.test(okand.text));
  assertEquals(provaTemperatur(180, { temp_range: "-20 to 80 °C" }, true).utfall, "ej_uppfyllt");
  assertEquals(provaTemperatur(120, { temperature_range: "-10…150 °C" }, false).utfall, "uppfyllt");
});
