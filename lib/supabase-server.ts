import type { User } from "@supabase/supabase-js";

/**
 * Verifies a Supabase access token through Supabase Auth.
 * The publishable key is intentionally sufficient here; no service-role key
 * is ever exposed to the browser or used for customer authentication.
 */
export async function getSupabaseUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
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
