"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { adminFetch, authHeaders } from "./admin-auth";
import { tabelleLesen, TabellenFehler } from "../../lib/xlsx-lesen";
import { dateischluessel, planBauen, planZusammenfassen, type Bestandskarte, type Plan, type Posten } from "../../lib/karten-import";

/** Massenanlage von Vorverkaufskarten aus einer Tabelle und einem Bildordner.
 *
 * **Kartenweise, nicht als Paket.** Die 144 Bilder eines Sets wiegen zusammen
 * gut 160 MB; eine Anfrage darf 22 MB tragen. Statt ein Bündelformat zu
 * erfinden, geht jede Karte einzeln über dieselbe Route wie das Formular für
 * eine einzelne Karte — dieselben Prüfungen, dieselbe Protokollierung, und ein
 * Fehler betrifft eine Zeile statt den ganzen Lauf.
 *
 * **Abbruch ist der Normalfall, nicht die Ausnahme.** Bei 144 Anfragen reicht
 * ein zugeklapptes Notebook. Deshalb wird vor jedem Lauf geholt, was schon im
 * Shop steht: Ein zweiter Anlauf setzt fort, statt zu verdoppeln.
 */

type Lauf = { laeuft: boolean; erledigt: number; abgebrochen: string };

/** Beschriftung des Startknopfs — er tut je nach Tabelle zweierlei. */
function beschriftung({ bereit, aktualisieren }: { bereit: number; aktualisieren: number }) {
  if (bereit + aktualisieren === 0) return "Nichts zu tun";
  const teile = [];
  if (bereit) teile.push(`${bereit} anlegen`);
  if (aktualisieren) teile.push(`${aktualisieren} berichtigen`);
  return teile.join(", ");
}

const ABBRUCH_NACH_FEHLERN = 5;

export function ImportPanel() {
  const [tabellenname, setTabellenname] = useState("");
  const [bilderzahl, setBilderzahl] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [note, setNote] = useState("");
  const [lauf, setLauf] = useState<Lauf>({ laeuft: false, erledigt: 0, abgebrochen: "" });
  const [ergebnisse, setErgebnisse] = useState<Map<number, string>>(new Map());

  // Zwei Sammlungen mit Absicht: Die Map dient dem Nachschlagen beim Hochladen,
  // die Liste behält **alle** ausgewählten Dateien. Würde der Plan nur die
  // Map-Werte sehen, wären zwei gleich benannte Dateien darin längst zu einer
  // verschmolzen — die Mehrdeutigkeit, vor der er warnen soll, wäre unsichtbar.
  const bilder = useRef(new Map<string, File>());
  const bilderliste = useRef<File[]>([]);
  const zeilen = useRef<Record<string, string>[]>([]);
  const stoppen = useRef(false);

  const planNeuBauen = useCallback(async () => {
    if (zeilen.current.length === 0 || bilderliste.current.length === 0) { setPlan(null); return; }
    setNote("");
    try {
      const antwort = await fetch("/api/admin/products?titel=manuell", { headers: await authHeaders() });
      const daten = await antwort.json() as { bestand?: Bestandskarte[]; error?: string };
      if (!antwort.ok || !daten.bestand) throw new Error(daten.error ?? "Der Bestand konnte nicht geladen werden.");
      setPlan(planBauen({
        zeilen: zeilen.current,
        bilder: bilderliste.current.map((datei) => ({ name: datei.name, size: datei.size, type: datei.type })),
        bestand: daten.bestand,
      }));
      setErgebnisse(new Map());
      setLauf({ laeuft: false, erledigt: 0, abgebrochen: "" });
    } catch (fehler) {
      setNote(fehler instanceof Error ? fehler.message : "Der Bestand konnte nicht geladen werden.");
    }
  }, []);

  async function tabelleWaehlen(datei: File | undefined) {
    if (!datei) return;
    setNote("");
    try {
      const { zeilen: gelesen } = await tabelleLesen(await datei.arrayBuffer());
      zeilen.current = gelesen;
      setTabellenname(`${datei.name} — ${gelesen.length} Zeilen`);
      await planNeuBauen();
    } catch (fehler) {
      zeilen.current = [];
      setTabellenname("");
      setPlan(null);
      setNote(fehler instanceof TabellenFehler
        ? fehler.message
        : "Die Tabelle konnte nicht gelesen werden. Erwartet wird eine .xlsx mit den Spalten „Titel“ und „Bilddatei“.");
    }
  }

  async function bilderWaehlen(dateien: FileList | null) {
    bilder.current = new Map();
    bilderliste.current = [...(dateien ?? [])];
    for (const datei of bilderliste.current) bilder.current.set(dateischluessel(datei.name), datei);
    setBilderzahl(bilderliste.current.length);
    await planNeuBauen();
  }

  async function starten() {
    if (!plan) return;
    stoppen.current = false;
    setNote("");
    setLauf({ laeuft: true, erledigt: 0, abgebrochen: "" });
    // Anlegen **und** Mengen ändern in einem Durchgang, in der Reihenfolge der
    // Tabelle. Zwei getrennte Knöpfe wären zwei Gelegenheiten, den zweiten zu
    // vergessen — und dann stünden nachgekaufte Stücke weiter auf Menge 1.
    const offen = plan.posten.filter((posten) => posten.stand === "bereit" || posten.stand === "aktualisieren");
    let erledigt = 0;
    let fehlerfolge = 0;
    let abgebrochen = "";

    for (const posten of offen) {
      if (stoppen.current) { abgebrochen = "Abgebrochen. Die bereits angelegten Karten bleiben stehen."; break; }
      const aendern = posten.stand === "aktualisieren";
      const datei = bilder.current.get(dateischluessel(posten.bilddatei));
      // Beim Ändern wird kein Bild gebraucht — die Karte hat schon eines.
      if (!datei && !aendern) {
        setErgebnisse((alt) => new Map(alt).set(posten.zeile, "Bild nicht mehr auffindbar."));
        continue;
      }
      try {
        const antwort = aendern
          ? await adminFetch("/api/admin/products", {
              method: "PATCH", json: true,
              body: JSON.stringify({
                id: posten.produktId, quantity: posten.menge,
                set: posten.set, variante: posten.variante, parallele: posten.parallele,
                nummerierung: posten.nummerierung, autogramm: posten.autogramm,
                graded: posten.graded, relic: posten.relic,
              }),
            })
          : await (async () => {
              const rumpf = new FormData();
              rumpf.set("title", posten.titel);
              rumpf.set("quantity", String(posten.menge));
              if (posten.beschreibung) rumpf.set("description", posten.beschreibung);
              if (posten.set) rumpf.set("set", posten.set);
              if (posten.variante) rumpf.set("variante", posten.variante);
              if (posten.parallele) rumpf.set("parallele", posten.parallele);
              if (posten.nummerierung) rumpf.set("nummerierung", posten.nummerierung);
              if (posten.autogramm) rumpf.set("autogramm", "ja");
              if (posten.graded) rumpf.set("graded", "ja");
              if (posten.relic) rumpf.set("relic", "ja");
              rumpf.append("images", datei!);
              return adminFetch("/api/admin/products", { method: "POST", body: rumpf });
            })();
        const daten = await antwort.json().catch(() => null) as { error?: string } | null;
        if (!antwort.ok) throw new Error(daten?.error ?? `Der Server antwortete mit ${antwort.status}.`);
        erledigt += 1;
        fehlerfolge = 0;
        setErgebnisse((alt) => new Map(alt).set(posten.zeile, aendern ? "berichtigt" : "angelegt"));
        setLauf((alt) => ({ ...alt, erledigt }));
      } catch (fehler) {
        fehlerfolge += 1;
        setErgebnisse((alt) => new Map(alt).set(posten.zeile,
          fehler instanceof Error ? fehler.message : "Fehlgeschlagen."));
        // Fünf Fehler hintereinander sind kein Zeilenproblem mehr, sondern eine
        // abgelaufene Sitzung oder ein Ausfall. Weiterlaufen hieße, hundertmal
        // dieselbe Fehlermeldung zu sammeln.
        if (fehlerfolge >= ABBRUCH_NACH_FEHLERN) {
          abgebrochen = `Nach ${ABBRUCH_NACH_FEHLERN} Fehlern in Folge gestoppt. Bitte die Meldung unten lesen — vermutlich ist die Anmeldung abgelaufen.`;
          break;
        }
      }
    }

    setLauf({ laeuft: false, erledigt, abgebrochen });
    if (!abgebrochen) {
      setNote(erledigt === offen.length
        ? `Fertig. ${erledigt} ${erledigt === 1 ? "Karte steht" : "Karten stehen"} im Vorverkauf.`
        : `${erledigt} von ${offen.length} Karten angelegt. Die übrigen stehen unten mit Grund.`);
    }
  }

  const zahlen = plan ? planZusammenfassen(plan) : null;
  const auffaellig = plan?.posten.filter((posten) => posten.stand !== "bereit" || ergebnisse.has(posten.zeile)) ?? [];

  return <section className="admin-section">
    <div className="admin-orders-heading">
      <h2>Karten aus Tabelle anlegen</h2>
      <Link className="back-link" href="/admin/karten">← Zur Kartenliste</Link>
    </div>

    <p className="admin-product-hint">
      Die Tabelle braucht die Spalten <strong>Titel</strong> und <strong>Bilddatei</strong>;
      <strong> Menge</strong>, <strong>Beschreibung</strong>, <strong>Set</strong>, <strong>Variante</strong> und
      <strong> Parallele</strong> sind freiwillig — ohne Menge wird ein Stück angelegt, und ohne Set und Variante
      lässt sich die Karte im Vorverkauf später nicht filtern.
      Alle übrigen Spalten werden gelesen, aber nicht verwendet — sie dürfen als Kontrollspalten stehen bleiben.
      Angelegt wird als Vorverkaufskarte ohne Festpreis, genau wie über das Einzelformular.
    </p>

    <div className="admin-import-quellen">
      <label className="form-field">
        <span>1. Tabelle (.xlsx)</span>
        <input type="file" accept=".xlsx" disabled={lauf.laeuft}
          onChange={(ereignis) => void tabelleWaehlen(ereignis.target.files?.[0])} />
        {tabellenname && <small>{tabellenname}</small>}
      </label>
      <label className="form-field">
        <span>2. Bilder (alle auf einmal auswählen)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={lauf.laeuft}
          onChange={(ereignis) => void bilderWaehlen(ereignis.target.files)} />
        {bilderzahl > 0 && <small>{bilderzahl} Bilder ausgewählt</small>}
      </label>
    </div>

    {note && <p className="form-feedback" role="status">{note}</p>}

    {zahlen && <>
      <ul className="admin-import-zahlen">
        <li><strong>{zahlen.bereit}</strong> anzulegen</li>
        <li><strong>{zahlen.aktualisieren}</strong> zu berichtigen</li>
        <li><strong>{zahlen.vorhanden}</strong> unverändert</li>
        <li className={zahlen.fehler > 0 ? "warnung" : undefined}><strong>{zahlen.fehler}</strong> fehlerhaft</li>
        <li className={zahlen.unbenutzt > 0 ? "warnung" : undefined}><strong>{zahlen.unbenutzt}</strong> Bilder ohne Zeile</li>
      </ul>

      {lauf.laeuft && <p className="form-feedback" role="status">
        Arbeite … {lauf.erledigt} von {zahlen.bereit + zahlen.aktualisieren}. Das Fenster bitte offen lassen.
      </p>}
      {lauf.abgebrochen && <p className="form-feedback" role="alert">{lauf.abgebrochen}</p>}

      <div className="admin-products-toolbar">
        {lauf.laeuft
          ? <button type="button" className="button button-outline" onClick={() => { stoppen.current = true; }}>Anhalten</button>
          : <button type="button" className="button button-primary" disabled={zahlen.bereit + zahlen.aktualisieren === 0} onClick={() => void starten()}>
              {beschriftung(zahlen)}
            </button>}
        {!lauf.laeuft && <button type="button" className="button button-outline" onClick={() => void planNeuBauen()}>Neu prüfen</button>}
      </div>

      {zahlen.fehler > 0 && !lauf.laeuft && <p className="admin-product-hint">
        Fehlerhafte Zeilen werden übersprungen — der Lauf bleibt daran nicht hängen.
      </p>}

      {auffaellig.length > 0 && <table className="admin-import-tabelle">
        <thead><tr><th>Zeile</th><th>Titel</th><th>Stand</th></tr></thead>
        <tbody>
          {auffaellig.map((posten: Posten) => {
            const ergebnis = ergebnisse.get(posten.zeile);
            // Nur echte Fehler werden rot. „Steht schon da" und „Menge ändern"
            // sind Auskünfte, keine Beanstandungen — sie rot zu färben ließe
            // einen sauberen Lauf wie einen halb misslungenen aussehen.
            const klasse = ergebnis
              ? (/^(angelegt|berichtigt)$/u.test(ergebnis) ? "gut" : "warnung")
              : posten.stand === "fehler" ? "warnung" : "";
            return <tr key={posten.zeile}>
              <td>{posten.zeile}</td>
              <td>{posten.titel || <em>ohne Titel</em>}</td>
              <td className={klasse}>{ergebnis ?? posten.grund}</td>
            </tr>;
          })}
        </tbody>
      </table>}

      {plan && plan.unbenutzteBilder.length > 0 && <details className="admin-import-uebrig">
        <summary>{plan.unbenutzteBilder.length} Bilder kommen in keiner Zeile vor</summary>
        <p className="admin-product-hint">{plan.unbenutzteBilder.join(", ")}</p>
      </details>}
    </>}
  </section>;
}
