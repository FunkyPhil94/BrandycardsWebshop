/** Prüft eine Importtabelle gegen den ausgewählten Bildordner und den Bestand.
 *
 * **Warum getrennt von der Oberfläche:** Hier entscheidet sich, ob 144 Karten
 * richtig oder falsch im Shop landen. Diese Entscheidung soll ein Test treffen
 * können, ohne einen Browser zu starten — das Panel in
 * `app/admin/import-panel.tsx` zeigt nur noch an, was hier herauskommt.
 *
 * **Der Plan wird vollständig gebaut, bevor irgendetwas hochgeladen wird.**
 * Ein Import, der bei Zeile 90 auf einen Fehler läuft, hinterlässt sonst 89
 * angelegte Karten und keine Auskunft darüber, was noch fehlt.
 */

import type { TabellenZeile } from "./xlsx-lesen";

export const SPALTE_TITEL = "Titel";
export const SPALTE_BILD = "Bilddatei";
export const SPALTE_MENGE = "Menge";
export const SPALTE_BESCHREIBUNG = "Beschreibung";

/** Deckel aus `app/api/admin/products/route.ts`. Doppelt gepflegt, aber hier
 *  sichtbar zu machen ist besser, als 144 Anfragen in denselben 400 laufen zu
 *  lassen — geprüft wird beides. */
export const MAX_TITEL = 200;
export const MAX_BESCHREIBUNG = 4000;
export const MAX_MENGE = 99;
export const MAX_BILD_BYTES = 10_000_000;
export const ERLAUBTE_BILDTYPEN = ["image/jpeg", "image/png", "image/webp"] as const;

export type PostenStand = "bereit" | "vorhanden" | "fehler";

export type Posten = {
  /** Zeilennummer im Tabellenblatt, also mit Kopfzeile — so wie Excel zählt. */
  zeile: number;
  titel: string;
  bilddatei: string;
  menge: number;
  beschreibung: string;
  stand: PostenStand;
  grund: string;
};

export type Bildangabe = { name: string; size: number; type: string };

export type PlanEingabe = {
  zeilen: TabellenZeile[];
  bilder: Bildangabe[];
  vorhandeneTitel: Iterable<string>;
};

export type Plan = {
  posten: Posten[];
  /** Bilder im Ordner, die in keiner Tabellenzeile vorkommen. Kein Fehler,
   *  aber fast immer ein Hinweis auf eine vergessene Zeile. */
  unbenutzteBilder: string[];
};

/** Groß-/Kleinschreibung und Leerzeichen sind bei Dateinamen aus Windows keine
 *  verlässliche Unterscheidung — für den Abgleich wird beides eingeebnet.
 *
 *  Dieselbe Funktion muss die Oberfläche beim Hochladen benutzen. Griffe sie
 *  anders zu, könnte der Plan „bereit" sagen und der Upload danach ein anderes
 *  Bild finden als das geprüfte. */
export function dateischluessel(name: string): string {
  return name.trim().toLowerCase();
}
const schluessel = dateischluessel;

function zahl(wert: string | undefined): number | null {
  const sauber = (wert ?? "").trim();
  if (sauber === "") return 1;   // leere Mengenspalte heißt: ein Stück
  if (!/^\d+$/u.test(sauber)) return null;
  const menge = Number.parseInt(sauber, 10);
  return menge >= 1 && menge <= MAX_MENGE ? menge : null;
}

export function planBauen({ zeilen, bilder, vorhandeneTitel }: PlanEingabe): Plan {
  // **Mehrdeutige Dateinamen sind gefährlicher als fehlende.** Zwei Dateien,
  // die sich nur in der Schreibweise unterscheiden — etwa aus zwei Ordnern
  // gleichzeitig ausgewählt — fielen sonst auf denselben Schlüssel, und die
  // Zeile bekäme stumm eines von beiden. Ein fehlendes Bild meldet sich, ein
  // vertauschtes nicht.
  const nachName = new Map<string, Bildangabe>();
  const mehrdeutig = new Set<string>();
  for (const bild of bilder) {
    const key = schluessel(bild.name);
    if (nachName.has(key)) mehrdeutig.add(key);
    nachName.set(key, bild);
  }

  const vorhanden = new Set<string>();
  for (const titel of vorhandeneTitel) vorhanden.add(schluessel(titel));

  const inTabelle = new Set<string>();
  const benutzt = new Set<string>();
  const posten: Posten[] = [];

  zeilen.forEach((zeile, index) => {
    const titel = (zeile[SPALTE_TITEL] ?? "").trim();
    const bilddatei = (zeile[SPALTE_BILD] ?? "").trim();
    const beschreibung = (zeile[SPALTE_BESCHREIBUNG] ?? "").trim();
    const menge = zahl(zeile[SPALTE_MENGE]);
    const posten_: Posten = {
      zeile: index + 2, titel, bilddatei, menge: menge ?? 1, beschreibung,
      stand: "bereit", grund: "",
    };

    const fehler = (grund: string) => { posten_.stand = "fehler"; posten_.grund = grund; };
    const bild = bilddatei ? nachName.get(schluessel(bilddatei)) : undefined;

    if (!titel) fehler("Kein Titel in der Zeile.");
    else if (titel.length > MAX_TITEL) fehler(`Der Titel ist ${titel.length} Zeichen lang, erlaubt sind ${MAX_TITEL}.`);
    else if (inTabelle.has(schluessel(titel))) fehler("Dieser Titel steht schon weiter oben in der Tabelle.");
    else if (menge === null) fehler(`Die Menge muss eine ganze Zahl zwischen 1 und ${MAX_MENGE} sein.`);
    else if (!bilddatei) fehler("Keine Bilddatei in der Zeile.");
    else if (!bild) fehler(`Das Bild „${bilddatei}“ ist nicht unter den ausgewählten Dateien.`);
    else if (mehrdeutig.has(schluessel(bilddatei))) {
      fehler(`Mehrere ausgewählte Dateien heißen „${bilddatei}“ — welche gemeint ist, lässt sich nicht entscheiden.`);
    }
    else if (bild.size > MAX_BILD_BYTES) fehler(`„${bilddatei}“ ist ${(bild.size / 1_000_000).toFixed(1)} MB groß, erlaubt sind 10 MB.`);
    else if (bild.type && !(ERLAUBTE_BILDTYPEN as readonly string[]).includes(bild.type)) {
      fehler(`„${bilddatei}“ ist kein JPG, PNG oder WebP.`);
    } else if (beschreibung.length > MAX_BESCHREIBUNG) fehler("Die Beschreibung ist zu lang.");
    // Der Bestandsabgleich kommt **zuletzt**: Eine fehlerhafte Zeile bleibt ein
    // Fehler, auch wenn zufällig eine Karte gleichen Titels schon dasteht.
    else if (vorhanden.has(schluessel(titel))) {
      posten_.stand = "vorhanden";
      posten_.grund = "Steht schon im Shop — wird übersprungen.";
    }

    if (titel) inTabelle.add(schluessel(titel));
    if (bild) benutzt.add(schluessel(bild.name));
    posten.push(posten_);
  });

  const unbenutzteBilder = bilder
    .filter((bild) => !benutzt.has(schluessel(bild.name)))
    .map((bild) => bild.name)
    .sort((a, b) => a.localeCompare(b, "de-DE"));

  return { posten, unbenutzteBilder };
}

export function planZusammenfassen(plan: Plan) {
  return {
    bereit: plan.posten.filter((posten) => posten.stand === "bereit").length,
    vorhanden: plan.posten.filter((posten) => posten.stand === "vorhanden").length,
    fehler: plan.posten.filter((posten) => posten.stand === "fehler").length,
    unbenutzt: plan.unbenutzteBilder.length,
  };
}
