/** eBay image URL helpers.
 *
 * Deliberately dependency-free so client components can import them without
 * pulling the eBay API client — and its credential handling — into the browser
 * bundle.
 *
 * eBay hands out thumbnail URLs. Both of its URL shapes encode the delivered
 * size in the path, so the full-resolution original is one string replacement
 * away, with no extra API call:
 *
 *   legacy  .../z/<hash>/$_1.JPG           ->  $_57.JPG     (225x400 -> 900x1600)
 *   modern  .../images/g/<hash>/s-l225.jpg ->  s-l1600.jpg
 *
 * Measured against the live CDN: s-l2400 returns the same bytes as s-l1600,
 * so 1600 is the ceiling worth asking for.
 */

export const EBAY_IMAGE_MAX = 1600;

const LEGACY = /\/\$_\d+\.(JPG|jpg|JPEG|jpeg|PNG|png|WEBP|webp)$/;
const MODERN = /\/s-l\d+\.(jpg|jpeg|png|webp)$/i;

/** Rewrites only the path. The legacy URLs carry a `?set_id=` query, and a
 * query value can contain something that looks like a size segment — the size
 * lives in the path, so only the path may be touched. */
function rewritePath(url: string, rewrite: (path: string) => string) {
  const cut = url.indexOf("?");
  if (cut === -1) return rewrite(url);
  return rewrite(url.slice(0, cut)) + url.slice(cut);
}

/** Rewrites an eBay image URL to its highest available resolution. */
export function maxResolutionImageUrl(url: string) {
  return rewritePath(url, (path) => path
    .replace(LEGACY, "/$_57.$1")
    .replace(MODERN, `/s-l${EBAY_IMAGE_MAX}.$1`));
}

/** Requests a specific width from eBay's CDN. Grid thumbnails do not need the
 * full original; the gallery does. Legacy URLs carry no size knob, so they are
 * returned unchanged rather than guessed at. */
export function ebayImageVariant(url: string, size: number) {
  return rewritePath(url, (path) => path.replace(MODERN, `/s-l${size}.$1`));
}
