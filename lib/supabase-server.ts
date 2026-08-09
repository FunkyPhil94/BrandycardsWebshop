import type { User } from "@supabase/supabase-js";

export type SupabaseAccessTokenClaims = {
  aal?: string;
  amr?: Array<{ method?: string; timestamp?: number } | string>;
};

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

/**
 * Reads claims only after `getSupabaseUser` has validated the same token with
 * Supabase Auth. This lets the server enforce the AAL/MFA level without
 * trusting browser storage or an unverified JWT on its own.
 */
export function getSupabaseAccessTokenClaims(request: Request): SupabaseAccessTokenClaims {
  const token = getBearerToken(request);
  if (!token) return {};
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - payload.length % 4) % 4);
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SupabaseAccessTokenClaims;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Verifies a Supabase access token through Supabase Auth.
 * The publishable key is intentionally sufficient here; no service-role key
 * is ever exposed to the browser or used for customer authentication.
 */
export async function getSupabaseUser(request: Request): Promise<User | null> {
  const token = getBearerToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as User;
}
