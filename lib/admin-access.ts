import { getAuthenticatedAppUser } from "./app-user";

export async function requireAdmin(request: Request) {
  let user;
  try {
    user = await getAuthenticatedAppUser(request);
  } catch {
    return { response: new Response(JSON.stringify({ error: "Authentifizierung konnte nicht geprüft werden." }), { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } }) };
  }
  if (!user) return { response: new Response(JSON.stringify({ error: "Nicht authentifiziert." }), { status: 401, headers: { "content-type": "application/json" } }) };
  if (user.role !== "ADMIN") return { response: new Response(JSON.stringify({ error: "Keine Berechtigung." }), { status: 403, headers: { "content-type": "application/json" } }) };
  return { response: undefined, user };
}
