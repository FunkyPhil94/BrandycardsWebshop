import type { Metadata } from "next";

/** The canonical public host. Preview/hosting URLs must never become SEO URLs. */
export const SHOP_BASE_URL = "https://shop.brandycards.de";

export function absoluteShopUrl(path = "/") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SHOP_BASE_URL}${suffix}`;
}

export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: absoluteShopUrl(input.path) },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
