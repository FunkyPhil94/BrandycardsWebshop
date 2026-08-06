"use client";

import Link from "next/link";
import { useState } from "react";

export type Feedback = { type: "success" | "error"; message: string } | null;

export function Field({ label, name, type = "text", required = true, placeholder, defaultValue }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string;
}) {
  return <label className="form-field">
    <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
    <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} />
  </label>;
}

export function PrivacyNotice() {
  return <p className="form-feedback">Wir verwenden deine Angaben nur zur Bearbeitung deiner Anfrage. Mehr dazu in unserer <Link href="/datenschutz">Datenschutz- und Löschinformation</Link>.</p>;
}

function errorMessage(data: unknown, fallback: string) {
  const error = (data as { error?: { message?: unknown } })?.error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(data, "Die Anfrage konnte nicht gesendet werden."));
  return "Danke! Deine Anfrage ist bei uns eingegangen. Wir melden uns per E-Mail.";
}

export async function postMultipart(path: string, form: HTMLFormElement) {
  const response = await fetch(path, { method: "POST", body: new FormData(form) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(data, "Die Anfrage konnte nicht gesendet werden."));
  return "Danke! Dein Kartenangebot und die Bilder sind sicher bei uns eingegangen.";
}

/** Wraps the submit/pending/feedback cycle every public form shares. */
export function useFormSubmit() {
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
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Es ist ein Fehler aufgetreten." });
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
