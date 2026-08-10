/** Countries supported by the shop's EU shipping policy. */
export const SHIPPING_COUNTRIES = [
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "BE", name: "Belgien" },
  { code: "BG", name: "Bulgarien" },
  { code: "HR", name: "Kroatien" },
  { code: "CY", name: "Zypern" },
  { code: "CZ", name: "Tschechien" },
  { code: "DK", name: "Dänemark" },
  { code: "EE", name: "Estland" },
  { code: "ES", name: "Spanien" },
  { code: "FI", name: "Finnland" },
  { code: "FR", name: "Frankreich" },
  { code: "GR", name: "Griechenland" },
  { code: "HU", name: "Ungarn" },
  { code: "IE", name: "Irland" },
  { code: "IT", name: "Italien" },
  { code: "LT", name: "Litauen" },
  { code: "LU", name: "Luxemburg" },
  { code: "LV", name: "Lettland" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Niederlande" },
  { code: "PL", name: "Polen" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Rumänien" },
  { code: "SE", name: "Schweden" },
  { code: "SI", name: "Slowenien" },
  { code: "SK", name: "Slowakei" },
] as const;

/** Germany is handled separately because it has its own shipping price. */
export const EU_COUNTRIES: ReadonlySet<string> = new Set(SHIPPING_COUNTRIES.filter(({ code }) => code !== "DE").map(({ code }) => code));
