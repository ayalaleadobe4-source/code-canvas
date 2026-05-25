import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PUBLIC_BASE_URL = (() => {
  const projectId = process.env.SUPABASE_PROJECT_ID || "";
  // Use stable Lovable preview URL pattern
  return `https://project--f9756e23-bacf-46f8-8d06-fdad00f55d19.lovable.app`;
})();

export const GITHUB_OAUTH_CALLBACK = `${PUBLIC_BASE_URL}/api/public/github/callback`;
export const GITHUB_OAUTH_SCOPES = "repo,read:user";

function getStateSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for state signing");
  return s;
}

export function signOAuthState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", getStateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const payload = `${userId}.${ts}`;
    const expected = crypto.createHmac("sha256", getStateSecret()).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    // 30-min validity
    if (Date.now() - Number(ts) > 30 * 60 * 1000) return null;
    return userId;
  } catch {
    return null;
  }
}

export function buildGithubAuthorizeUrl(userId: string): string {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Missing GITHUB_OAUTH_CLIENT_ID");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", GITHUB_OAUTH_CALLBACK);
  url.searchParams.set("scope", GITHUB_OAUTH_SCOPES);
  url.searchParams.set("state", signOAuthState(userId));
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  scope: string;
}> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing GitHub OAuth secrets");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: GITHUB_OAUTH_CALLBACK,
    }),
  });
  const data = (await res.json()) as { access_token?: string; scope?: string; error?: string };
  if (!data.access_token) throw new Error(`OAuth exchange failed: ${data.error || "no token"}`);
  return { access_token: data.access_token, scope: data.scope || "" };
}

export async function saveGithubConnection(userId: string, accessToken: string, scope: string) {
  const octo = new Octokit({ auth: accessToken });
  const { data: me } = await octo.users.getAuthenticated();
  await supabaseAdmin.from("github_connections").upsert({
    user_id: userId,
    github_username: me.login,
    github_user_id: me.id,
    access_token: accessToken,
    scope,
    updated_at: new Date().toISOString(),
  });
  return { username: me.login };
}

export async function getOctokitForUser(userId: string): Promise<Octokit | null> {
  const { data, error } = await supabaseAdmin
    .from("github_connections")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.access_token) return null;
  return new Octokit({ auth: data.access_token });
}
