import { cache } from "react";
import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListings, inventory, productAssets, products } from "../../../db/schema";
import { istImKatalogSichtbar, verfuegbareMenge } from "../../../lib/catalog-availability";
import { absoluteShopUrl } from "../../../lib/seo";

type SeoCard = {
  id: string;
  title: string;
  description: string | null;
  category: "Festpreis" | "Direkt bei uns";
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  imageUrls: string[];
};

export const loadSeoCard = cache(async (id: string): Promise<SeoCard | null> => {
  if (!/^[a-f0-9]{32}$/iu.test(id)) return null;
  const db = getDb();
  const rows = await db.select({ product: products, listing: ebayListings, stock: inventory })
    .from(products)
    .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.id, id), eq(products.status, "ACTIVE")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const manual = row.product.origin === "MANUAL";
  if (!manual && row.listing?.status !== "ACTIVE") return null;
  if (!istImKatalogSichtbar(row.product.kind, row.listing?.listingType, row.listing?.quantity, row.stock, row.product.origin)) return null;

  const assets = await db.select({ sourceUrl: productAssets.sourceUrl })
    .from(productAssets)
    .where(eq(productAssets.productId, id))
    .orderBy(asc(productAssets.sortOrder));

  return {
    id: row.product.id,
    title: row.product.title,
    description: row.product.description,
    category: manual ? "Direkt bei uns" : "Festpreis",
    priceAmountCents: manual ? null : row.listing?.priceAmountCents ?? null,
    priceCurrency: manual ? row.product.priceCurrency : row.listing?.priceCurrency ?? "EUR",
    quantity: verfuegbareMenge(row.listing?.quantity ?? null, row.stock, row.product.origin),
    imageUrls: assets.map((asset) => asset.sourceUrl).filter((url): url is string => Boolean(url)),
  };
});

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</gu, "\\u003c").replace(/>/gu, "\\u003e").replace(/&/gu, "\\u0026");
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await loadSeoCard(id);
  const url = absoluteShopUrl(`/karten/${id}`);
  if (!card) {
    return { title: "Karte nicht verfügbar", robots: { index: false, follow: false }, alternates: { canonical: url } };
  }

  const description = card.description?.trim() || `Sportkarte ${card.title} bei BrandyCards — für Sammler geprüft und sicher verpackt.`;
  return {
    title: card.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: card.title,
      description,
      images: card.imageUrls.length ? card.imageUrls : undefined,
    },
    twitter: {
      card: card.imageUrls.length ? "summary_large_image" : "summary",
      title: card.title,
      description,
      images: card.imageUrls.length ? card.imageUrls : undefined,
    },
  };
}

export default async function KartenDetailLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const card = await loadSeoCard(id);
  if (!card) return children;

  const url = absoluteShopUrl(`/karten/${card.id}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    name: card.title,
    description: card.description?.trim() || `Sportkarte ${card.title} bei BrandyCards.`,
    image: card.imageUrls.length ? card.imageUrls : undefined,
    sku: card.id,
    brand: { "@type": "Brand", name: "BrandyCards" },
    category: "Sports trading card",
    ...(card.category === "Festpreis" && card.priceAmountCents !== null ? {
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: card.priceCurrency,
        price: (card.priceAmountCents / 100).toFixed(2),
        availability: card.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    } : {}),
  };

  return <>
    {children}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
  </>;
}
