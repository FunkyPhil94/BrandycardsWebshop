"use client";

import { useEffect, useState } from "react";
import { NurAngemeldet, useKontoSitzung } from "../account-shell";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { useI18n } from "../../i18n";

export default function KontoDatenPage() {
  return <NurAngemeldet><MeineDaten /></NurAngemeldet>;
}

function MeineDaten() {
  const { user, token, aktualisieren } = useKontoSitzung();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deletionReady, setDeletionReady] = useState<boolean | null>(null);

  // Ob die Löschung bereitsteht, hängt an einem Secret auf dem Server. Die
  // Antwort entscheidet, ob unten ein Knopf oder ein Hinweis auf die
  // E-Mail-Adresse steht.
  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/delete", { headers: { Authorization: `Bearer ${await token()}` } });
        const body = await response.json() as { available?: boolean };
        if (!abgebrochen) setDeletionReady(response.ok && body.available === true);
      } catch {
        if (!abgebrochen) setDeletionReady(false);
      }
    })();
    return () => { abgebrochen = true; };
  }, [token, user]);

  /** Auskunft nach Art. 15 DSGVO. Der Browser lädt die Datei selbst herunter —
   *  der Umweg über ein `<a download>` ist nötig, weil die Route ein
   *  `Authorization`-Bearer braucht und ein einfacher Link keinen mitschickt. */
  async function downloadData() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/data", { headers: { Authorization: `Bearer ${await token()}` } });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? t("Die Auskunft konnte nicht erstellt werden."));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "brandycards-meine-daten.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage(t("Deine Daten wurden heruntergeladen."));
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t("Die Auskunft konnte nicht erstellt werden."));
    } finally {
      setBusy(false);
    }
  }

  /** Kontolöschung nach Art. 17 DSGVO. Zwei Hürden mit Absicht: Der Text muss
   *  abgetippt werden, danach fragt der Browser noch einmal. Die Aktion lässt
   *  sich nicht rückgängig machen, und ein Fehlklick kostet echte Daten. */
  async function deleteAccount() {
    const deleteWord = t("LÖSCHEN");
    const eingabe = window.prompt(t("Dein Konto und alle Daten dazu werden endgültig gelöscht. Anfragen, Kartenangebote samt Bildern, Preisvorschläge und deine Anmeldung werden entfernt. Bestellungen bleiben als Rechnungsbeleg gespeichert, ohne Verknüpfung zu dir.\n\nTippe {{word}}, um fortzufahren.", { word: deleteWord }));
    if (eingabe?.trim().toUpperCase() !== deleteWord.toUpperCase()) return;
    if (!window.confirm(t("Wirklich löschen? Das lässt sich nicht rückgängig machen."))) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${await token()}` } });
      const body = await response.json().catch(() => ({})) as { error?: string; verbleibendeBestellungen?: number };
      if (!response.ok) throw new Error(body.error ?? t("Das Konto konnte nicht gelöscht werden."));
      await getSupabaseBrowserClient().auth.signOut();
      aktualisieren();
      setMessage(body.verbleibendeBestellungen
        ? `${t("Dein Konto ist gelöscht.")} ${body.verbleibendeBestellungen === 1
          ? t("Eine Bestellung bleibt als Rechnungsbeleg gespeichert.")
          : t("{{count}} Bestellungen bleiben als Rechnungsbelege gespeichert.", { count: body.verbleibendeBestellungen })} ${t("Dazu sind wir gesetzlich verpflichtet. Eine Bestätigung ist unterwegs.")}`
        : t("Dein Konto ist gelöscht. Eine Bestätigung ist unterwegs."));
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t("Das Konto konnte nicht gelöscht werden."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="privacy-panel" aria-labelledby="privacy-title">
    <h1 id="privacy-title">{t("Meine Daten")}</h1>
    <p>{t("Du kannst jederzeit herunterladen, was wir über dich gespeichert haben, und dein Konto selbst löschen.")}</p>
    <div className="privacy-actions">
      <button className="button button-outline" type="button" onClick={downloadData} disabled={busy}>{t("Meine Daten herunterladen")}</button>
      {deletionReady && <button className="privacy-delete" type="button" onClick={deleteAccount} disabled={busy}>{t("Konto endgültig löschen")}</button>}
    </div>
    {deletionReady === false && <p className="privacy-note">{t("Zum Löschen deines Kontos schreib uns kurz an")} <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a>. {t("Wir erledigen das von Hand.")}</p>}
    <p className="privacy-note">{t("Beim Löschen verschwinden Anfragen, Kartenangebote samt Bildern, Preisvorschläge und deine Anmeldung.")} <strong>{t("Bestellungen bleiben als Rechnungsbeleg gespeichert.")}</strong> {t("Dazu sind wir gesetzlich verpflichtet. Die Verknüpfung zu deinem Konto wird aufgehoben.")}</p>
    {message && <p className="form-feedback" role="status">{message}</p>}
  </section>;
}
