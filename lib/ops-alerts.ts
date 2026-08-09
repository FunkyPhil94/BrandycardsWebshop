import { getEmailConfig } from "./email/config.ts";
import { protokolliereVersand, sendEmail } from "./email/send.ts";
import { operationalAlert } from "./email/templates.ts";

export type Betriebsalarm = {
  key: string;
  category: string;
  title: string;
  detail: string;
  occurredAt?: string;
};

/** Hält Diagnose-Text klein und verhindert, dass Fremdantworten als Log- oder
 * Alarmnachricht ganze Payloads einschleusen. */
export function kurzeAlarmdetails(value: unknown, maxLength = 600): string {
  const text = String(value ?? "Unbekannter Fehler.")
    .replace(/[\r\n\t]+/gu, " ")
    .replace(/\s{2,}/gu, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/** Sendet einen Betriebsalarm an den Betreiber, ohne den auslösenden Ablauf zu
 * gefährden. Fehlt Resend, bleibt der Alarm als eindeutige Cloudflare-Logzeile
 * sichtbar; eine kaputte Alarm-Mail darf keinen Auftrag erneut scheitern lassen. */
export async function notifyOperationalAlert(alarm: Betriebsalarm): Promise<void> {
  try {
    const config = getEmailConfig();
    if (!config) {
      console.error("[ops-alert] Kein Alarmversand: RESEND_API_KEY fehlt.", { key: alarm.key, category: alarm.category });
      return;
    }

    const result = await sendEmail(config.sellerEmail, operationalAlert({
      key: alarm.key,
      category: kurzeAlarmdetails(alarm.category, 100),
      title: kurzeAlarmdetails(alarm.title, 160),
      detail: kurzeAlarmdetails(alarm.detail),
      occurredAt: alarm.occurredAt ?? new Date().toISOString(),
      shopUrl: config.shopUrl,
    }));
    protokolliereVersand("Betriebsalarm", result, { alertKey: alarm.key, category: alarm.category });
  } catch (error) {
    console.error("[ops-alert] Alarm konnte nicht versendet werden.", {
      key: alarm.key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
