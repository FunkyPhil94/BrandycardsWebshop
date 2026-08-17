"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Ein Bild groß, über allem anderen.
 *
 * Es gibt genau **eine** Lightbox im Projekt. Die Kartendetailseite zeigt damit
 * das Kartenfoto, der Adminbereich das eingesendete Bild eines Ankaufsangebots.
 * Eine zweite Umsetzung wäre doppelte Pflege und liefe beim nächsten Umbau
 * auseinander — Aussehen und Tastaturbedienung stehen deshalb hier, einmal.
 *
 * **Aufrufer geben `key={src}` mit.** Ein anderes Bild fängt dadurch wieder
 * eingepasst an, statt den Betrachter unvermittelt in den Ausschnitt eines
 * Bildes zu stellen, das er noch nie ganz gesehen hat. Über `key` statt über
 * einen Effekt, der `useState` zurücksetzt — das wäre eine Kaskade von
 * Renderdurchläufen für etwas, das React von sich aus kann.
 *
 * `zoombar` schaltet die Ansicht in Originalauflösung frei. Sie ist **nicht**
 * überall an: Auf der Kundenseite sind die eBay-Bilder ohnehin auf eine
 * Anzeigegröße beschnitten, dort gäbe es nichts zu gewinnen. Im Ankauf zählt
 * jeder Pixel, weil Kanten und Ecken über den Preis entscheiden.
 */
export function Lightbox({ src, alt, label, onClose, zoombar = false, schliessenLabel = "Schließen" }: {
  src: string;
  alt: string;
  /** Was Screenreader beim Öffnen ansagen. */
  label: string;
  onClose: () => void;
  zoombar?: boolean;
  schliessenLabel?: string;
}) {
  const [einsZuEins, setEinsZuEins] = useState(false);
  const buehne = useRef<HTMLDivElement | null>(null);
  const zug = useRef<{ x: number; y: number; links: number; oben: number } | null>(null);

  // Schließen muss ohne Maus gehen. Solange das Bild offen ist, steht der
  // Hintergrund still — sonst scrollt die Seite darunter weg.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  /** In die Mitte des Bildes, nicht in die linke obere Ecke.
   *
   * Beim Umschalten auf 1:1 ist die Mitte das, was der Betrachter gerade
   * angesehen hat. Oben links stünde er im Rand und müsste erst suchen. */
  const mittig = useCallback(() => {
    const rahmen = buehne.current;
    if (!rahmen) return;
    rahmen.scrollLeft = (rahmen.scrollWidth - rahmen.clientWidth) / 2;
    rahmen.scrollTop = (rahmen.scrollHeight - rahmen.clientHeight) / 2;
  }, []);
  useEffect(() => { if (einsZuEins) mittig(); }, [einsZuEins, mittig]);

  // Ziehen nur mit der Maus: Auf Touchgeräten scrollt der Rahmen von sich aus,
  // und ein zusätzlich gefangener Zeiger würde genau das lahmlegen.
  function ziehenStart(event: React.PointerEvent<HTMLDivElement>) {
    const rahmen = buehne.current;
    if (!rahmen || event.pointerType !== "mouse") return;
    zug.current = { x: event.clientX, y: event.clientY, links: rahmen.scrollLeft, oben: rahmen.scrollTop };
    rahmen.setPointerCapture(event.pointerId);
  }
  function ziehen(event: React.PointerEvent<HTMLDivElement>) {
    const rahmen = buehne.current;
    if (!rahmen || !zug.current) return;
    rahmen.scrollLeft = zug.current.links - (event.clientX - zug.current.x);
    rahmen.scrollTop = zug.current.oben - (event.clientY - zug.current.y);
  }
  function ziehenEnde(event: React.PointerEvent<HTMLDivElement>) {
    if (!zug.current) return;
    buehne.current?.releasePointerCapture(event.pointerId);
    zug.current = null;
  }

  return <div className="lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
    {zoombar && <button
      type="button"
      className="lightbox-zoom"
      aria-pressed={einsZuEins}
      onClick={(event) => { event.stopPropagation(); setEinsZuEins((an) => !an); }}
    >{einsZuEins ? "Einpassen" : "Originalgröße"}</button>}
    <button type="button" className="lightbox-close" onClick={onClose} aria-label={schliessenLabel}>✕</button>

    {einsZuEins
      // In der 1:1-Ansicht füllt der Rahmen das Fenster. Ein Klick darin
      // schließt nicht — er wäre sonst kaum vom Ende einer Ziehbewegung zu
      // unterscheiden. Zum Schließen bleiben ✕ und Escape.
      ? <div
          ref={buehne}
          className="lightbox-buehne"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={ziehenStart}
          onPointerMove={ziehen}
          onPointerUp={ziehenEnde}
          onPointerCancel={ziehenEnde}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onLoad={mittig} draggable={false} />
        </div>
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />}
  </div>;
}
