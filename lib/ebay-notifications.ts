const EBAY_API_SCOPE = "https://api.ebay.com/oauth/api_scope";
const PUBLIC_KEY_CACHE_TTL_MS = 60 * 60 * 1000;
const APPLICATION_TOKEN_SAFETY_MS = 60 * 1000;

export const EBAY_NOTIFICATION_TOPIC = "ORDER_CONFIRMATION";
export const EBAY_NOTIFICATION_ENDPOINT_DEFAULT = "https://shop.brandycards.de/api/ebay/notifications";
export const EBAY_NOTIFICATION_MAX_BODY_BYTES = 256 * 1024;

type SignatureHeader = {
  alg?: unknown;
  kid?: unknown;
  signature?: unknown;
  digest?: unknown;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

type PublicKeyResponse = {
  key?: unknown;
};

type ApplicationTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type RecordValue = Record<string, unknown>;

let applicationTokenCache: CachedValue<string> | undefined;
const publicKeyCache = new Map<string, CachedValue<string>>();

export type EbaySignatureVerification = {
  valid: boolean;
  retryable: boolean;
};

export type EbayOrderLineItem = {
  listingId: string;
  quantity: number;
};

export type EbayOrderConfirmation = {
  notificationId: string;
  orderId: string | null;
  lineItems: EbayOrderLineItem[];
};

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function apiBase() {
  return process.env.EBAY_ENVIRONMENT === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

export function ebayNotificationEndpoint() {
  return process.env.EBAY_NOTIFICATION_ENDPOINT?.trim() || EBAY_NOTIFICATION_ENDPOINT_DEFAULT;
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseSignatureHeader(value: string): SignatureHeader | null {
  try {
    const decoded = new TextDecoder().decode(decodeBase64(value));
    const parsed = JSON.parse(decoded) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function derLength(bytes: Uint8Array, offset: number): { length: number; next: number } | null {
  const first = bytes[offset];
  if (first === undefined) return null;
  if (first < 0x80) return { length: first, next: offset + 1 };
  const count = first & 0x7f;
  if (count === 0 || count > 4 || offset + count >= bytes.length) return null;
  let length = 0;
  for (let index = 1; index <= count; index += 1) length = (length * 256) + bytes[offset + index]!;
  return { length, next: offset + count + 1 };
}

function derInteger(bytes: Uint8Array, offset: number): { value: Uint8Array; next: number } | null {
  if (bytes[offset] !== 0x02) return null;
  const length = derLength(bytes, offset + 1);
  if (!length || length.next + length.length > bytes.length) return null;
  return { value: bytes.slice(length.next, length.next + length.length), next: length.next + length.length };
}

/** eBay sends the ECDSA value in ASN.1 DER, WebCrypto expects r || s. */
function ecdsaDerToP1363(signature: Uint8Array): Uint8Array | null {
  if (signature.length === 64) return signature;
  if (signature[0] !== 0x30) return null;
  const sequenceLength = derLength(signature, 1);
  if (!sequenceLength || sequenceLength.next + sequenceLength.length !== signature.length) return null;
  const r = derInteger(signature, sequenceLength.next);
  if (!r) return null;
  const s = derInteger(signature, r.next);
  if (!s || s.next !== signature.length) return null;

  const output = new Uint8Array(64);
  for (const [source, target] of [[r.value, 0], [s.value, 32]] as const) {
    let start = 0;
    while (start < source.length - 1 && source[start] === 0) start += 1;
    const trimmed = source.slice(start);
    if (trimmed.length > 32) return null;
    output.set(trimmed, target + 32 - trimmed.length);
  }
  return output;
}

function pemToDer(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  return decodeBase64(base64);
}

async function getApplicationToken(): Promise<string> {
  const now = Date.now();
  if (applicationTokenCache && applicationTokenCache.expiresAt > now) return applicationTokenCache.value;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("eBay-Anwendungsschlüssel fehlen.");

  const response = await fetch(`${apiBase()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_API_SCOPE }),
  });
  if (!response.ok) throw new Error(`eBay-Anwendungstoken fehlgeschlagen (${response.status}).`);
  const body = await response.json() as ApplicationTokenResponse;
  const token = nonEmptyString(body.access_token);
  if (!token) throw new Error("eBay-Anwendungstoken fehlt in der Antwort.");
  const expiresIn = typeof body.expires_in === "number" && Number.isFinite(body.expires_in) ? body.expires_in : 7_200;
  applicationTokenCache = { value: token, expiresAt: now + Math.max(60_000, expiresIn * 1_000 - APPLICATION_TOKEN_SAFETY_MS) };
  return token;
}

async function getPublicKey(keyId: string): Promise<string> {
  const now = Date.now();
  const cached = publicKeyCache.get(keyId);
  if (cached && cached.expiresAt > now) return cached.value;

  const response = await fetch(`${apiBase()}/commerce/notification/v1/public_key/${encodeURIComponent(keyId)}`, {
    headers: {
      Authorization: `Bearer ${await getApplicationToken()}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`eBay-Public-Key fehlgeschlagen (${response.status}).`);
  const body = await response.json() as PublicKeyResponse;
  const key = nonEmptyString(body.key);
  if (!key) throw new Error("eBay-Public-Key fehlt in der Antwort.");
  publicKeyCache.set(keyId, { value: key, expiresAt: now + PUBLIC_KEY_CACHE_TTL_MS });
  return key;
}

export async function verifyEbayNotificationSignature(rawBody: string, signatureHeader: string): Promise<EbaySignatureVerification> {
  const parsed = parseSignatureHeader(signatureHeader);
  const algorithm = nonEmptyString(parsed?.alg)?.toLowerCase();
  const digest = nonEmptyString(parsed?.digest)?.toUpperCase();
  const keyId = nonEmptyString(parsed?.kid);
  const encodedSignature = nonEmptyString(parsed?.signature);
  if (algorithm !== "ecdsa" || !["SHA1", "SHA256"].includes(digest ?? "") || !keyId || !encodedSignature) return { valid: false, retryable: false };

  try {
    const publicKey = await getPublicKey(keyId);
    const signature = ecdsaDerToP1363(decodeBase64(encodedSignature));
    if (!signature) return { valid: false, retryable: false };
    const cryptoKey = await crypto.subtle.importKey("spki", asArrayBuffer(pemToDer(publicKey)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const bodies = [rawBody];
    try {
      const parsedBody = JSON.parse(rawBody) as unknown;
      const normalizedBody = JSON.stringify(parsedBody);
      if (normalizedBody !== rawBody) bodies.push(normalizedBody);
    } catch {
      return { valid: false, retryable: false };
    }
    const hash = digest === "SHA1" ? "SHA-1" : "SHA-256";
    for (const body of bodies) {
      const valid = await crypto.subtle.verify({ name: "ECDSA", hash }, cryptoKey, asArrayBuffer(signature), asArrayBuffer(new TextEncoder().encode(body)));
      if (valid) return { valid: true, retryable: false };
    }
    return { valid: false, retryable: false };
  } catch (error) {
    console.error("[ebay-notification] Signatur konnte nicht geprüft werden.", error instanceof Error ? error.message : error);
    return { valid: false, retryable: true };
  }
}

export async function buildEbayChallengeResponse(challengeCode: string, verificationToken = process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN, endpoint = ebayNotificationEndpoint()): Promise<string> {
  if (!verificationToken) throw new Error("eBay-Notification-Verifikationstoken fehlt.");
  const digest = await crypto.subtle.digest("SHA-256", asArrayBuffer(new TextEncoder().encode(`${challengeCode}${verificationToken}${endpoint}`)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseEbayOrderConfirmation(value: unknown): EbayOrderConfirmation | null {
  const envelope = asRecord(value);
  const metadata = asRecord(envelope?.metadata);
  const notification = asRecord(envelope?.notification);
  const data = asRecord(notification?.data);
  const order = asRecord(data?.order);
  if (metadata?.topic !== EBAY_NOTIFICATION_TOPIC) return null;

  const notificationId = nonEmptyString(notification?.notificationId);
  if (!notificationId || !Array.isArray(order?.orderLineItems)) return null;
  const lineItems = new Map<string, number>();
  for (const value of order.orderLineItems) {
    const line = asRecord(value);
    const listingId = nonEmptyString(line?.listingId);
    const quantity = typeof line?.quantity === "number" ? line.quantity : Number(line?.quantity);
    if (!listingId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10_000) return null;
    lineItems.set(listingId, (lineItems.get(listingId) ?? 0) + quantity);
  }
  if (!lineItems.size) return null;
  return {
    notificationId,
    orderId: nonEmptyString(order?.orderId),
    lineItems: [...lineItems.entries()].map(([listingId, quantity]) => ({ listingId, quantity })),
  };
}
