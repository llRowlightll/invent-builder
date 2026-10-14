/// <reference lib="deno.ns" />
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { provaGripkraft, provaSpanning, provaTryck, tolkaSpanningar, tolkaTryckBar } from "./kontroller.ts";

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
