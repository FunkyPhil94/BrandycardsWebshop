import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** Die Obergrenze für hochgeladene Formulare — **und nicht nur für
       *  Server Actions.**
       *
       * vinext hält jede POST-Anfrage mit `multipart/form-data` ohne
       * Action-Kennung für eine progressive Server Action
       * (`isProgressiveServerActionRequest`) und wendet diese Grenze an,
       * *bevor* die Route überhaupt läuft. Der Kartenankauf unter
       * `/api/card-submissions` ist genau so eine Anfrage: Ab dem Standardwert
       * von 1 MB kam `413 Payload Too Large` als Klartext zurück — auf einer
       * Seite, die 10 MB je Bild und fünf Bilder verspricht. Ein einziges
       * Handyfoto reichte, und in der Datenbank landete nichts, weil die Route
       * nie erreicht wurde.
       *
       * 52 MB, weil die Route selbst genau dort ihre Grenze zieht
       * (`app/api/card-submissions/route.ts`: 52.000.000 Byte für die gesamte
       * Anfrage, 50.000.000 für die Bilder zusammen). Die Prüfung mit der
       * verständlichen Fehlermeldung soll die Route machen, nicht das
       * Rahmenwerk mit einer Klartextzeile.
       */
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
