"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HONEYPOT_FIELD, RENDERED_AT_FIELD } from "../lib/form-bot-guard.ts";
import { useI18n } from "./i18n";

export type Feedback = { type: "success" | "error"; message: string } | null;

/** Two fields no customer ever sees or fills in.
 *
 * The honeypot is hidden from sight *and* from assistive technology, and
 * autofill is switched off so a password manager does not fill it on someone's
 * behalf. The timestamp lets the server tell a typed form from a posted one.
 * See lib/form-bot-guard.ts and docs/security-findings.md, E-2.
 */
export function BotGuardFields() {
  const { t } = useI18n();
  // The stamp is written straight to the input after mount rather than held in
  // React state: the clock is not something a component may read while
  // rendering, and the server has no business deciding when the visitor's page
  // appeared. Until hydration the field reads "0", which the server treats as
  // "no stamp" and lets through — a form submitted without scripting is judged
  // by the honeypot alone.
  const stamp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = stamp.current;
    if (!input) return;
    const restamp = () => { input.value = String(Date.now()); };
    restamp();
    // A successful submit calls form.reset(), which puts the field back to its
    // default of "0". Without re-stamping, the timing check would only ever
    // apply to the first submission from a page.
    const form = input.form;
    const onReset = () => queueMicrotask(restamp);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, []);
  return <>
    <input ref={stamp} type="hidden" name={RENDERED_AT_FIELD} defaultValue="0" />
    <div aria-hidden="true" className="bot-guard">
      <label>
        {t("Bitte dieses Feld leer lassen")}
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  </>;
}

/** Reads the two guard fields out of a form so JSON submitters can pass them on. */
export function botGuardPayload(form: HTMLFormElement): Record<string, unknown> {
  const data = new FormData(form);
  return {
    [HONEYPOT_FIELD]: String(data.get(HONEYPOT_FIELD) ?? ""),
    [RENDERED_AT_FIELD]: Number(data.get(RENDERED_AT_FIELD) ?? 0),
  };
}

export function Field({ label, name, type = "text", required = true, placeholder, defaultValue }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string;
}) {
  return <label className="form-field">
    <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
    <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} />
  </label>;
}

export function PrivacyNotice() {
  const { t } = useI18n();
  return <p className="form-feedback">{t("Wir verwenden deine Angaben nur zur Bearbeitung deiner Anfrage. Mehr dazu in unserer")} <Link href="/datenschutz">{t("Datenschutz- und Löschinformation")}</Link>.</p>;
}

function errorMessage(data: unknown, fallback: string) {
  const error = (data as { error?: { message?: unknown } })?.error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export async function postJson(path: string, payload: Record<string, unknown>, successMessage = "Danke! Deine Anfrage ist bei uns eingegangen. Wir melden uns per E-Mail.", fallback = "Die Anfrage konnte nicht gesendet werden.") {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(data, fallback));
  return successMessage;
}

export async function postMultipart(path: string, form: HTMLFormElement, successMessage = "Danke! Dein Kartenangebot und die Bilder sind sicher bei uns eingegangen.", fallback = "Die Anfrage konnte nicht gesendet werden.") {
  const response = await fetch(path, { method: "POST", body: new FormData(form) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(data, fallback));
  return successMessage;
}

/** Wraps the submit/pending/feedback cycle every public form shares. */
export function useFormSubmit() {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);

  async function run(event: React.FormEvent<HTMLFormElement>, send: (form: HTMLFormElement) => Promise<string>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFeedback(null);
    setPending(true);
    try {
      setFeedback({ type: "success", message: await send(form) });
      form.reset();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? t(error.message) : t("Es ist ein Fehler aufgetreten.") });
    } finally {
      setPending(false);
    }
  }

  return { feedback, pending, run, setFeedback };
}

export function FormFeedback({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <p className={`form-feedback ${feedback.type}`} role="status">{feedback.message}</p>;
}
