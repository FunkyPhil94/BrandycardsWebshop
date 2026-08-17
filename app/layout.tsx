import type { Metadata } from "next";
import "./globals.css";
import logo from "./brand/brandycards-logo.png";
import { GlobalLegalNav, I18nProvider } from "./i18n";
import { ViewTracker } from "./view-tracker";
import { SHOP_BASE_URL } from "../lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SHOP_BASE_URL),
  title: { default: "BrandyCards Sports Cards", template: "%s | BrandyCards" },
  description: "Ausgewählte Sportkarten, persönlich ausgesucht und sicher verpackt.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  keywords: ["Sportkarten", "Fußballkarten", "Sammelkarten", "BrandyCards"],
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: ["en_GB"],
    siteName: "BrandyCards",
    title: "BrandyCards Sports Cards",
    description: "Ausgewählte Sportkarten, persönlich ausgesucht und sicher verpackt.",
    images: [{ url: logo.src, width: logo.width, height: logo.height, alt: "BrandyCards" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BrandyCards Sports Cards",
    description: "Ausgewählte Sportkarten, persönlich ausgesucht und sicher verpackt.",
    images: [logo.src],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" suppressHydrationWarning><body><I18nProvider>{children}<GlobalLegalNav /><ViewTracker /></I18nProvider></body></html>;
}
