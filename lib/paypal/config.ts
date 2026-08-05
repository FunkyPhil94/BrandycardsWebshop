import { env } from "cloudflare:workers";

export type PayPalEnvironment = "sandbox" | "production";

export type PayPalConfig = {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  webhookId: string;
};

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function getPayPalConfig(): PayPalConfig {
  const values = runtimeEnv();
  const environment = values.PAYPAL_ENVIRONMENT === "production" ? "production" : "sandbox";
  const clientId = values.PAYPAL_CLIENT_ID?.trim() ?? "";
  const clientSecret = values.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  const webhookId = values.PAYPAL_WEBHOOK_ID?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new Error("PayPal ist noch nicht konfiguriert.");
  }

  return { clientId, clientSecret, environment, webhookId };
}

export function getPayPalApiBaseUrl(environment: PayPalEnvironment): string {
  return environment === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}
