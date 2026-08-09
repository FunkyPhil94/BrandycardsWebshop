"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate, type Locale } from "../lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const LOCALE_KEY = "brandycards-locale";

function readLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === "en" || stored === "de") return stored;
    return navigator.language.toLowerCase().startsWith("en") ? "en" : "de";
  } catch {
    return "de";
  }
}

function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
    document.cookie = `${LOCALE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale;
  } catch {
    // Private browsing may reject storage. The in-memory choice still works.
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");
  useEffect(() => {
    const next = readLocale();
    // Restore the persisted client preference after hydration. The provider
    // intentionally renders German on the server to keep the initial markup
    // stable, then synchronises the browser preference once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);
  const value = useMemo(() => ({ locale, setLocale, t: (key: string, values?: Record<string, string | number>) => translate(locale, key, values) }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return <div className="language-switch" aria-label={t("Sprache") }>
    <button type="button" className={locale === "de" ? "active" : ""} aria-pressed={locale === "de"} onClick={() => setLocale("de")} title={t("Deutsch")}>
      <span aria-hidden="true">&#x1F1E9;&#x1F1EA;</span><span className="language-code">DE</span>
    </button>
    <span aria-hidden="true" className="language-divider">/</span>
    <button type="button" className={locale === "en" ? "active" : ""} aria-pressed={locale === "en"} onClick={() => setLocale("en")} title={t("English")}>
      <span aria-hidden="true">&#x1F1EC;&#x1F1E7;</span><span className="language-code">EN</span>
    </button>
  </div>;
}

export function GlobalLegalNav() {
  const { t } = useI18n();
  return <nav className="legal-nav" aria-label={t("Rechtliche Informationen")}>
    <a href="/impressum">{t("Impressum")}</a>
    <a href="/datenschutz">{t("Datenschutz")}</a>
    <a href="/agb">{t("AGB")}</a>
    <a href="/widerruf">{t("Widerruf")}</a>
    <a href="/versand-zahlung">{t("Versand & Zahlung")}</a>
  </nav>;
}

