/**
 * Utkast: det besökaren skrivit i ett formulär finns kvar efter en omladdning,
 * ett misslyckat skick eller ett klick bort och tillbaka (ägaren 2026-11-17:
 * "så att man inte behöver copy pasta allt igen").
 *
 * Sparas i sessionStorage, alltså bara i den här fliken och bara tills den
 * stängs -- inget finns kvar på en delad dator dagen efter, och det är
 * användarens egen inmatning under besöket (inget samtycke behövs för det).
 * Minne mellan besök sköter webbläsarens autofyll (autoComplete på fälten)
 * och, för inloggade, profilen.
 *
 * Lösenord och betalkortsuppgifter får aldrig gå hit.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { lasUtkast, sparaUtkast } from "./utkast-lagring";

export { lasUtkast, rensaUtkast, sparaUtkast } from "./utkast-lagring";

/**
 * Som useState, men värdet överlever en omladdning i samma flik. Utkastet läses
 * först efter första renderingen (servern har inget sessionStorage), och
 * skrivs bara därefter, så att startvärdet aldrig skriver över ett utkast.
 */
export function useUtkast<T>(nyckel: string, start: T): [T, Dispatch<SetStateAction<T>>] {
  const [varde, setVarde] = useState<T>(start);
  const [last, setLast] = useState(false);

  useEffect(() => {
    const sparat = lasUtkast<T>(nyckel);
    if (sparat != null) setVarde(sparat);
    setLast(true);
  }, [nyckel]);

  useEffect(() => {
    if (last) sparaUtkast(nyckel, varde);
  }, [nyckel, varde, last]);

  return [varde, setVarde];
}
