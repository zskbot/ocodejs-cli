const COOKIE = "ocode_session";
const STATE_COOKIE = "ocode_oauth_state";
const SESSION_TTL = 7 * 24 * 60 * 60;
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function cookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf("="); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function cookie(name, value, maxAge, path = "/") {
  return name + "=" + encodeURIComponent(value) + "; Path=" + path + "; Max-Age=" + maxAge + "; HttpOnly; Secure; SameSite=Lax";
}
function clearCookie(name, path = "/") {
  return name + "=; Path=" + path + "; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}
function b64(bytes) {
  let binary = ""; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function unb64(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function b64url(bytes) { return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes); crypto.getRandomValues(data); return b64url(data);
}
async function sha256(value) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
async function encryptionKey(value) {
  if (!value) throw new Error("auth_not_configured");
  const raw = unb64(value);
  if (raw.byteLength !== 32) throw new Error("auth_not_configured");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(token, env) {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const key = await encryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token));
  return b64(iv) + "." + b64(ciphertext);
}
async function decryptToken(payload, env) {
  const [iv, ciphertext, extra] = payload.split(".");
  if (!iv || !ciphertext || extra) throw new Error("invalid_ciphertext");
  const key = await encryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ciphertext));
  return dec.decode(plaintext);
}
function originAllowed(request, env) {
  return request.headers.get("Origin") === env.APP_ORIGIN;
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  if (origin !== env.APP_ORIGIN) return null;
  return { "Access-Control-Allow-Origin": env.APP_ORIGIN, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Ocode-CSRF", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
}
async function rateLimit(request, env, windowMs = 900000, maximum = 20) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await sha256(ip);
  const window = Math.floor(Date.now() / windowMs);
  const row = await env.DB.prepare("INSERT INTO auth_rate_limits(key_hash, window_id, hits) VALUES(?, ?, 1) ON CONFLICT(key_hash) DO UPDATE SET window_id=excluded.window_id, hits=CASE WHEN auth_rate_limits.window_id=excluded.window_id THEN auth_rate_limits.hits+1 ELSE 1 END RETURNING hits").bind(key, window).first();
  return Number(row?.hits || 0) <= maximum;
}
async function githubRequest(path, token, init = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "OCodeJS-CLI-Hub", ...(init.headers || {}) },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(response.status === 401 ? "github_token_invalid" : "github_api_error");
  return { data: await response.json(), scopes: (response.headers.get("x-oauth-scopes") || "").split(",").map(x => x.trim()).filter(Boolean) };
}
async function saveCredential(user, token, kind, scopes, env) {
  const encrypted = await encryptToken(token, env);
  await env.DB.prepare("INSERT INTO auth_users(github_id, github_login, token_ciphertext, token_kind, scopes, updated_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET github_login=excluded.github_login, token_ciphertext=excluded.token_ciphertext, token_kind=excluded.token_kind, scopes=excluded.scopes, updated_at=excluded.updated_at")
    .bind(String(user.id), user.login, encrypted, kind, JSON.stringify(scopes || []), Date.now()).run();
}
async function createSession(githubId, env) {
  const id = randomToken(), csrf = randomToken(), expires = Date.now() + SESSION_TTL * 1000;
  await env.DB.prepare("INSERT INTO auth_sessions(id_hash, github_id, csrf_hash, expires_at) VALUES(?, ?, ?, ?)").bind(await hmac(id, env.SESSION_SECRET), String(githubId), await hmac(csrf, env.SESSION_SECRET), expires).run();
  return { id, csrf };
}
async function findSession(request, env) {
  const id = cookies(request)[COOKIE];
  if (!id || id.length > 128) return null;
  return env.DB.prepare("SELECT s.id_hash, s.github_id, s.csrf_hash, s.expires_at, u.github_login, u.token_ciphertext, u.token_kind, u.scopes FROM auth_sessions s JOIN auth_users u ON u.github_id=s.github_id WHERE s.id_hash=? AND s.expires_at>?").bind(await hmac(id, env.SESSION_SECRET), Date.now()).first();
}
async function requireSession(request, env) {
  const session = await findSession(request, env);
  if (!session) return { error: json({ error: "not_authenticated" }, 401) };
  const csrf = request.headers.get("X-Ocode-CSRF");
  if (!csrf || await hmac(csrf, env.SESSION_SECRET) !== session.csrf_hash) return { error: json({ error: "csrf_check_failed" }, 403) };
  return { session };
}
function publicUser(row) {
  let scopes = []; try { scopes = JSON.parse(row.scopes || "[]"); } catch {}
  return { id: String(row.github_id), login: row.github_login, method: row.token_kind, scopes };
}
async function githubProfile(token) {
  const result = await githubRequest("/user", token);
  const u = result.data;
  return { user: { id: String(u.id), login: u.login, name: u.name, avatar_url: u.avatar_url, html_url: u.html_url }, scopes: result.scopes };
}
async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/health" && request.method === "GET") return json({ ok: true, service: "ocodejs-auth-worker", patConfigured: Boolean(env.DB && env.SESSION_SECRET && env.TOKEN_ENCRYPTION_KEY), oauthConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (path.startsWith("/auth/") && !(await rateLimit(request, env, 900000, 20))) return json({ error: "rate_limit_exceeded" }, 429);
  if (path.startsWith("/api/") && !(await rateLimit(request, env, 60000, 60))) return json({ error: "rate_limit_exceeded" }, 429);
  if (path === "/auth/github" && request.method === "GET") {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return json({ error: "github_oauth_not_configured" }, 503);
    const state = randomToken();
    await env.DB.prepare("INSERT INTO oauth_states(state_hash, expires_at) VALUES(?, ?)").bind(await sha256(state), Date.now() + 600000).run();
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", url.origin + "/auth/github/callback");
    authorize.searchParams.set("scope", "read:user");
    authorize.searchParams.set("state", state);
    return new Response(null, { status: 302, headers: { Location: authorize.toString(), "Set-Cookie": cookie(STATE_COOKIE, state, 600, "/auth/github/callback"), "Cache-Control": "no-store" } });
  }
  if (path === "/auth/github/callback" && request.method === "GET") {
    const state = url.searchParams.get("state"), code = url.searchParams.get("code");
    const stateCookie = cookies(request)[STATE_COOKIE];
    const headers = new Headers({ "Set-Cookie": clearCookie(STATE_COOKIE, "/auth/github/callback"), "Cache-Control": "no-store" });
    if (url.searchParams.has("error")) { headers.set("Location", env.APP_ORIGIN + "/?auth=cancelled"); return new Response(null, { status: 302, headers }); }
    if (!code || !state || !stateCookie || state !== stateCookie) return new Response("OAuth state validation failed", { status: 400, headers });
    const valid = await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash=? AND expires_at>? RETURNING state_hash").bind(await sha256(state), Date.now()).first();
    if (!valid) return new Response("OAuth state expired or already used", { status: 400, headers });
    try {
      const exchange = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }), signal: AbortSignal.timeout(12000) });
      const payload = await exchange.json();
      if (!exchange.ok || !payload.access_token) return new Response("GitHub OAuth exchange failed", { status: 400, headers });
      const profile = await githubProfile(payload.access_token);
      await saveCredential(profile.user, payload.access_token, "oauth", profile.scopes, env);
      const session = await createSession(profile.user.id, env);
      headers.append("Set-Cookie", cookie(COOKIE, session.id, SESSION_TTL));
      headers.set("Location", env.APP_ORIGIN + "/?auth=connected");
      return new Response(null, { status: 302, headers });
    } catch { return new Response("GitHub OAuth connection failed", { status: 502, headers }); }
  }
  if (path === "/auth/pat" && request.method === "POST") {
    if (!originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: "request_too_large" }, 413);
    let body; try { body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
    const token = body?.token;
    if (typeof token !== "string" || token.length < 20 || token.length > 500 || /\s/.test(token)) return json({ error: "invalid_token_format" }, 400);
    try {
      const profile = await githubProfile(token);
      await saveCredential(profile.user, token, "pat", profile.scopes, env);
      const session = await createSession(profile.user.id, env);
      return json({ connected: true, user: { id: profile.user.id, login: profile.user.login, method: "pat", scopes: profile.scopes }, csrfToken: session.csrf }, 201, { "Set-Cookie": cookie(COOKIE, session.id, SESSION_TTL) });
    } catch (error) {
      if (error.message === "github_token_invalid") return json({ error: "github_token_invalid" }, 401);
      return json({ error: "pat_connection_failed" }, 502);
    }
  }
  if (path === "/auth/session" && request.method === "GET") {
    const session = await findSession(request, env);
    if (!session) return json({ connected: false });
    const csrf = randomToken();
    await env.DB.prepare("UPDATE auth_sessions SET csrf_hash=? WHERE id_hash=?").bind(await hmac(csrf, env.SESSION_SECRET), session.id_hash).run();
    return json({ connected: true, user: publicUser(session), csrfToken: csrf });
  }
  if (path === "/auth/logout" && request.method === "POST") {
    if (!originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403);
    const auth = await requireSession(request, env); if (auth.error) return auth.error;
    await env.DB.prepare("DELETE FROM auth_sessions WHERE id_hash=?").bind(auth.session.id_hash).run();
    return json({ disconnected: true }, 200, { "Set-Cookie": clearCookie(COOKIE) });
  }
  if (path === "/auth/disconnect" && request.method === "POST") {
    if (!originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403);
    const auth = await requireSession(request, env); if (auth.error) return auth.error;
    await env.DB.prepare("DELETE FROM auth_sessions WHERE github_id=?").bind(auth.session.github_id).run();
    await env.DB.prepare("DELETE FROM auth_users WHERE github_id=?").bind(auth.session.github_id).run();
    return json({ disconnected: true, credentialsDeleted: true }, 200, { "Set-Cookie": clearCookie(COOKIE) });
  }
  if (path === "/api/github/user" && request.method === "GET") {
    if (!originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403);
    const auth = await requireSession(request, env); if (auth.error) return auth.error;
    try {
      const token = await decryptToken(auth.session.token_ciphertext, env);
      const profile = await githubProfile(token);
      return json(profile.user);
    } catch { return json({ error: "github_user_request_failed" }, 502); }
  }
  if (path === "/api/github/repos" && request.method === "GET") {
    if (!originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403);
    const auth = await requireSession(request, env); if (auth.error) return auth.error;
    try {
      const token = await decryptToken(auth.session.token_ciphertext, env);
      const page = Math.min(10, Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
      const result = await githubRequest("/user/repos?per_page=100&sort=updated&page=" + page, token);
      return json(result.data.map(r => ({ id: r.id, name: r.name, full_name: r.full_name, private: r.private, html_url: r.html_url, description: r.description, updated_at: r.updated_at })));
    } catch { return json({ error: "github_repos_request_failed" }, 502); }
  }
  return json({ error: "not_found" }, 404);
}
export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (cors === null) return json({ error: "origin_not_allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors || {} });
    try {
      const response = await handle(request, env);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors || {})) headers.set(key, value);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return json({ error: "internal_server_error" }, 500, cors || {});
    }
  }
};
