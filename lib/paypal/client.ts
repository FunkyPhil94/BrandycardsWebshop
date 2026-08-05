import { getPayPalApiBaseUrl, getPayPalConfig } from "./config";
import { centsToPayPalValue } from "./money";

type PayPalTokenResponse = { access_token?: string };

export type PayPalOrderRequest = {
  referenceId: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
};

export type PayPalOrderResponse = {
  id?: string;
  status?: string;
  links?: Array<{ href: string; rel: string; method?: string }>;
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(10_000) });
}

async function getAccessToken(): Promise<string> {
  const config = getPayPalConfig();
  const baseUrl = getPayPalApiBaseUrl(config.environment);
  const response = await fetchWithTimeout(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("PayPal-Authentifizierung fehlgeschlagen.");
  const data = await response.json() as PayPalTokenResponse;
  if (!data.access_token) throw new Error("PayPal lieferte kein Zugriffstoken.");
  return data.access_token;
}

export async function createPayPalOrder(input: PayPalOrderRequest): Promise<PayPalOrderResponse> {
  const config = getPayPalConfig();
  const token = await getAccessToken();
  const response = await fetchWithTimeout(`${getPayPalApiBaseUrl(config.environment)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": input.referenceId,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: input.referenceId,
        amount: { currency_code: input.currency, value: centsToPayPalValue(input.amountCents) },
      }],
      application_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl },
    }),
  });
  if (!response.ok) throw new Error("PayPal-Order konnte nicht erstellt werden.");
  return await response.json() as PayPalOrderResponse;
}

export async function verifyPayPalWebhookSignature(input: {
  body: string;
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
}): Promise<boolean> {
  const config = getPayPalConfig();
  const token = await getAccessToken();
  const response = await fetchWithTimeout(`${getPayPalApiBaseUrl(config.environment)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: input.authAlgo,
      cert_url: input.certUrl,
      transmission_id: input.transmissionId,
      transmission_sig: input.transmissionSig,
      transmission_time: input.transmissionTime,
      webhook_id: input.webhookId,
      webhook_event: JSON.parse(input.body),
    }),
  });
  if (!response.ok) return false;
  const data = await response.json() as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
