/** Bild-Importe.
 *
 * Gebraucht, seit das Logo aus dem Build kommt statt aus `public/`: Nur so
 * bekommt es einen Inhalts-Hash im Dateinamen und damit `cache-control:
 * immutable` — Dateien unter `public/` werden bei jedem Seitenaufruf neu
 * validiert.
 *
 * **Die Form ist gemessen, nicht angenommen — und die naheliegende Annahme war
 * falsch.** Unter reinem Vite liefert ein Bild-Import eine Zeichenkette; ich
 * hatte das hier zuerst so deklariert. vinext folgt aber Next.js und liefert
 * ein Objekt. Sichtbar wurde es erst im Browser: `src="[object Object]"`, das
 * Logo lud nicht, und die Kopfleiste fiel von 126 px auf 59 px zusammen. Der
 * Typprüfer hatte nichts zu beanstanden, weil die Deklaration selbst die
 * falsche Behauptung war. Im Bauergebnis steht `{src, width, height}`.
 *
 * **Folge für die Verwendung:** immer `bild.src`, nie `bild` — ein `<img
 * src={bild}>` bricht still, weil JSX das Objekt zu `[object Object]`
 * verkettet, statt einen Fehler zu werfen.
 */
type ImportiertesBild = {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
  blurWidth?: number;
  blurHeight?: number;
};

declare module "*.png" {
  const bild: ImportiertesBild;
  export default bild;
}

declare module "*.jpg" {
  const bild: ImportiertesBild;
  export default bild;
}
