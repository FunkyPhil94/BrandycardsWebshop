/** Merkmale einer eBay-Karte aus ihrem Titel ableiten.
 *
 * **Nur für eBay-Karten.** Von Hand eingestellte Karten bringen Auflage,
 * Autogramm, Bewertung und Relikt aus der Importtabelle mit; dort steht die
 * Auskunft gepflegt. eBay liefert nur den Titel, über Jahre unterschiedlich
 * gebaut — und trotzdem soll der Katalog dieselben vier Schalter haben.
 *
 * **Abgeleitet wird beim Import, nicht bei der Abfrage.** Das Ergebnis landet
 * in denselben Spalten wie bei den manuellen Karten. Der Filter bleibt dadurch
 * überall eine Spaltenabfrage, und diese Regeln stehen an einer Stelle, wo ein
 * Test sie erreicht — statt als Muster in SQL, wo weder das eine noch das
 * andere gilt.
 *
 * Die Wortlisten stammen vom Betreiber (2026-08-20), nicht aus einer Vermutung.
 */

/** Ein Zahlenpaar wie `24/25`, `049/150`. Der Blick nach vorn und zurück
 *  verhindert, dass `2017/2018` als `017/201` gelesen wird. */
const PAAR = /(?<![\d/])(\d{1,4})\s*\/\s*(\d{1,4})(?![\d/])/gu;
/** Eine Auflage ohne Zähler: „Elite Society /50". */
const BLANKO = /(?<![\d/])\/\s*(\d{1,4})(?![\d/])/u;

const AUTOGRAMM = /\b(?:autographs?|auto|signed|signiert|signature)\b/iu;
/** Vom Betreiber benannt: Relikt zählt `relic`, `jersey` und `patch`. */
const RELIKT = /\b(?:relics?|jersey|patch|memorabilia)\b/iu;
/** Bewertungshäuser plus das Wort selbst. `PGS` steht mit drin, weil der
 *  Betreiber es ausdrücklich genannt hat. */
const BEWERTUNG = /\b(?:psa|pgs|bgs|sgc|cgc|csg|hga|beckett|graded|grading)\b/iu;

/** Die Auflage aus dem Titel — oder `null`.
 *
 * **Der ganze Aufwand steckt in der Saison.** `Topps UCC Gold 25/26 …` trägt
 * ein Zahlenpaar, das keine Auflage ist. Ein naives `Zahl/Zahl` traf am
 * 2026-08-20 einhundertzweiundsechzig von zweihunderteinundsiebzig Titeln;
 * nummeriert sind einhundertzwanzig.
 *
 * Die Regel, gemessen an allen 271 Titeln des Bestands:
 *
 * 1. Gleich lange, **aufeinanderfolgende** Zahlen sind eine Saison — `24/25`,
 *    `2017/2018`.
 * 2. **Es sei denn, davor stand schon ein Paar.** `Topps Merlin UCC 24/25 …
 *    Elite Society 49/50` trägt beides: vorn die Saison, hinten die Auflage.
 *    Die Saison steht immer im Setnamen und damit zuerst.
 *
 * Der Rest — `05/10`, `127/199`, `65/76` — ist eine Auflage, ohne weitere
 * Prüfung. Gefährlich wäre allein ein Titel, dessen **einziges** Paar
 * aufeinanderfolgt und der keine Saison trägt (`… Gold 49/50`). Im Bestand gab
 * es davon null; träte er auf, bliebe die Karte ungefiltert — ein fehlender
 * Treffer, kein falscher.
 */
export function auflageAusTitel(titel: string): string | null {
  const paare = [...titel.matchAll(PAAR)];
  for (const [index, treffer] of paare.entries()) {
    const [, links, rechts] = treffer;
    const saison = links!.length === rechts!.length && Number(rechts) === Number(links) + 1;
    if (saison && index === 0) continue;
    return `${links}/${rechts}`;
  }
  return BLANKO.exec(titel)?.[0].replace(/\s+/gu, "") ?? null;
}

export function hatAutogramm(titel: string): boolean {
  return AUTOGRAMM.test(titel);
}

export function hatRelikt(titel: string): boolean {
  return RELIKT.test(titel);
}

export function istBewertet(titel: string): boolean {
  return BEWERTUNG.test(titel);
}

/** Alle vier auf einmal, in der Form, die `products` erwartet. */
export function merkmaleAusTitel(titel: string) {
  return {
    numbering: auflageAusTitel(titel),
    autograph: hatAutogramm(titel),
    graded: istBewertet(titel),
    relic: hatRelikt(titel),
  };
}
