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
export const SPALTE_SET = "Set";
export const SPALTE_VARIANTE = "Variante";
export const SPALTE_PARALLELE = "Parallele";

/** Deckel für Set, Variante und Parallele. Kurz gehalten: Es sind Namen aus der
 *  Checkliste des Herstellers, keine Fließtexte. */
export const MAX_EINORDNUNG = 120;

/** Deckel aus `app/api/admin/products/route.ts`. Doppelt gepflegt, aber hier
 *  sichtbar zu machen ist besser, als 144 Anfragen in denselben 400 laufen zu
 *  lassen — geprüft wird beides. */
export const MAX_TITEL = 200;
export const MAX_BESCHREIBUNG = 4000;
export const MAX_MENGE = 99;
export const MAX_BILD_BYTES = 10_000_000;
export const ERLAUBTE_BILDTYPEN = ["image/jpeg", "image/png", "image/webp"] as const;

/** `aktualisieren` heißt: Die Karte steht schon da, **aber nicht so, wie die
 *  Tabelle sie beschreibt** — abweichende Menge, fehlendes Set, andere Variante.
 *
 *  Ohne diesen Zustand wäre ein zweiter Durchgang wirkungslos: Die Zeile liefe
 *  als „vorhanden" durch, und der alte Wert bliebe stehen, ohne dass irgendwo
 *  ein Fehler auftaucht. Genau so wären die zuerst eingestellten Karten für
 *  immer ohne Einordnung geblieben — sichtbar im Vorverkauf, aber unter keinem
 *  Filter auffindbar. */
export type PostenStand = "bereit" | "aktualisieren" | "vorhanden" | "fehler";

export type Posten = {
  /** Zeilennummer im Tabellenblatt, also mit Kopfzeile — so wie Excel zählt. */
  zeile: number;
  titel: string;
  bilddatei: string;
  menge: number;
  beschreibung: string;
  /** Serie, Reihe und Veredelung — leer, wenn die Tabelle sie nicht führt. */
  set: string;
  variante: string;
  parallele: string;
  stand: PostenStand;
  grund: string;
  /** Nur bei `aktualisieren` gesetzt: die Karte, die zu ändern ist. */
  produktId?: string;
};

export type Bildangabe = { name: string; size: number; type: string };

/** Eine Karte, die schon im Shop steht. */
export type Bestandskarte = {
  id: string; titel: string; menge: number;
  set?: string | null; variante?: string | null; parallele?: string | null;
};

export type PlanEingabe = {
  zeilen: TabellenZeile[];
  bilder: Bildangabe[];
  bestand: Iterable<Bestandskarte>;
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

export function planBauen({ zeilen, bilder, bestand }: PlanEingabe): Plan {
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

  const vorhanden = new Map<string, Bestandskarte>();
  for (const karte of bestand) vorhanden.set(schluessel(karte.titel), karte);

  const inTabelle = new Set<string>();
  const benutzt = new Set<string>();
  const posten: Posten[] = [];

  zeilen.forEach((zeile, index) => {
    const titel = (zeile[SPALTE_TITEL] ?? "").trim();
    const bilddatei = (zeile[SPALTE_BILD] ?? "").trim();
    const beschreibung = (zeile[SPALTE_BESCHREIBUNG] ?? "").trim();
    const set = (zeile[SPALTE_SET] ?? "").trim();
    const variante = (zeile[SPALTE_VARIANTE] ?? "").trim();
    const parallele = (zeile[SPALTE_PARALLELE] ?? "").trim();
    const menge = zahl(zeile[SPALTE_MENGE]);
    const posten_: Posten = {
      zeile: index + 2, titel, bilddatei, menge: menge ?? 1, beschreibung,
      set, variante, parallele, stand: "bereit", grund: "",
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
    else if ([set, variante, parallele].some((wert) => wert.length > MAX_EINORDNUNG)) {
      fehler(`Set, Variante und Parallele dürfen höchstens ${MAX_EINORDNUNG} Zeichen haben.`);
    }
    // Der Bestandsabgleich kommt **zuletzt**: Eine fehlerhafte Zeile bleibt ein
    // Fehler, auch wenn zufällig eine Karte gleichen Titels schon dasteht.
    else {
      const schon = vorhanden.get(schluessel(titel));
      if (schon) {
        // **Nicht nur die Menge vergleichen.** Die Einordnung kam später dazu;
        // bei den zuerst eingestellten Karten steht sie noch nicht in der
        // Datenbank. Wer hier nur auf die Menge sähe, ließe genau diese Karten
        // ungefiltert liegen — sichtbar im Vorverkauf, aber unter keinem Set.
        const gruende = [];
        if (schon.menge !== posten_.menge) gruende.push(`Menge ${schon.menge} → ${posten_.menge}`);
        if ((schon.set ?? "") !== set) gruende.push("Set");
        if ((schon.variante ?? "") !== variante) gruende.push("Variante");
        if ((schon.parallele ?? "") !== parallele) gruende.push("Parallele");
        if (gruende.length === 0) {
          posten_.stand = "vorhanden";
          posten_.grund = "Steht schon im Shop — wird übersprungen.";
        } else {
          posten_.stand = "aktualisieren";
          posten_.produktId = schon.id;
          posten_.grund = `Steht schon im Shop, wird berichtigt: ${gruende.join(", ")}.`;
        }
      }
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
  const zaehle = (stand: PostenStand) => plan.posten.filter((posten) => posten.stand === stand).length;
  return {
    bereit: zaehle("bereit"),
    aktualisieren: zaehle("aktualisieren"),
    vorhanden: zaehle("vorhanden"),
    fehler: zaehle("fehler"),
    unbenutzt: plan.unbenutzteBilder.length,
  };
}
