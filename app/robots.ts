import type { MetadataRoute } from "next";
import { absoluteShopUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/api/"] }],
    sitemap: absoluteShopUrl("/sitemap.xml"),
    host: absoluteShopUrl("/"),
  };
}
