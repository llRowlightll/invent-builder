/// <reference lib="deno.ns" />
import { assertEquals } from "jsr:@std/assert@^1";
import { provaSpanning, provaTryck, tolkaSpanningar, tolkaTryckBar } from "./kontroller.ts";

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
