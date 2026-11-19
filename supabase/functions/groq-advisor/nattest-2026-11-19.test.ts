import { assert, assertEquals } from "jsr:@std/assert@^1";
import { bokstavsaxlarITexten, detectEndEffectorIntent, needsOutdoor, needsRodLock, needsVerticalLoad } from "./signals.ts";
import { langderITexten } from "./kravbild.ts";
import { kandaVarden } from "./fragor.ts";

// Nattestet 2026-11-19: maskinbyggaren mot drift på fyra språk.

Deno.test("lyft känns igen på engelska, tyska och spanska", () => {
  for (const t of [
    "Lift a 50 kg fixture 500 mm vertically, it must not drop if air is lost",
    "Kartons mit 15 kg 400 mm anheben",
    "Levantar cajas de 20 kg 300 mm",
    "Hay operarios trabajando debajo de la carga",
    "Mitarbeiter stehen manchmal unter der Last",
  ]) assert(needsVerticalLoad(t), t);
  for (const t of [
    "Conveyor diverter pushing 2 kg parcels sideways 200 mm",
    "Forklift pallets are stopped by a pallet stop",
    "Empujar paquetes de 3 kg en una cinta",
  ]) assert(!needsVerticalLoad(t), t);
});

Deno.test("'must not drop' kräver lasthållning", () => {
  for (const t of ["it must not drop if air is lost", "the load must not fall", "Die Last darf nicht herunterfallen", "la carga no debe bajar"]) {
    assert(needsRodLock(t), t);
  }
  assert(!needsRodLock("Push parcels sideways 200 mm"));
});

Deno.test("riktningen räknas som känd när texten säger lyft, på alla språk", () => {
  for (const t of ["Lift a 50 kg fixture 500 mm vertically", "Kartons 400 mm anheben", "Levantar cajas de 20 kg 300 mm", "push parcels sideways"]) {
    assertEquals(kandaVarden(t).riktning, true, t);
  }
  assertEquals(kandaVarden("Pressa in kullager med 5 kN").riktning, false);
});

Deno.test("gripdon och sugkoppar känns igen på engelska, tyska och spanska", () => {
  assertEquals(detectEndEffectorIntent("Pick and place circuit boards, vacuum cups"), "vacuum");
  assertEquals(detectEndEffectorIntent("Kartons mit Saugnapf aufnehmen"), "vacuum");
  assertEquals(detectEndEffectorIntent("Coger cajas con ventosas"), "vacuum");
  assertEquals(detectEndEffectorIntent("Pinza para sujetar piezas de 1 kg"), "gripper");
  assertEquals(detectEndEffectorIntent("Parallelgreifer für Wellen 8 kg"), "gripper");
  assertEquals(detectEndEffectorIntent("Two grippers for a robot cell"), "gripper");
  assertEquals(detectEndEffectorIntent("Empujar paquetes de 3 kg"), null);
});

Deno.test("saltvatten och båtar är korrosiv utomhusmiljö", () => {
  assert(needsOutdoor("Lucka på en båt, saltvatten och sol"));
  assert(needsOutdoor("hatch on a boat, sea water spray"));
  assert(needsOutdoor("Klappe auf einem Schiff"));
  assert(needsOutdoor("escotilla de un barco, agua salada"));
  assert(!needsOutdoor("Skjuta lådor på ett band inomhus"));
});

Deno.test("måttet läses som slag med rörelseord på tyska och spanska, och axeln efter måttet", () => {
  assertEquals(langderITexten("Kartons mit 15 kg 400 mm anheben")[0].typ, "lyft");
  assertEquals(langderITexten("Levantar cajas de 20 kg 300 mm")[0].typ, "lyft");
  assertEquals(langderITexten("Zylinder schiebt 5 kg Produkte 100 mm")[0].typ, "sidled");
  assertEquals(langderITexten("Elektrisk axel som ska positionera 5 kg 800 mm")[0].typ, "sidled");
  assertEquals(bokstavsaxlarITexten("300 mm X travel and 80 mm Z"), [{ axis: "X", stroke: 300 }, { axis: "Z", stroke: 80 }]);
  assertEquals(bokstavsaxlarITexten("400 mm i X och 100 mm i Z"), [{ axis: "X", stroke: 400 }, { axis: "Z", stroke: 100 }]);
  assertEquals(bokstavsaxlarITexten("låda 300 mm x 200 mm, lyfta 2 kg"), []);
});
