# OCode.js Auth Worker

Free-tier Cloudflare Workers + D1 implementation of the CLI Hub authentication API. This Worker is separate from the existing `ocodejs-cli` static-assets Worker.

## Bindings and variables

- D1 binding: `DB` → database `ocodejs-auth-db`
- Plain variable: `APP_ORIGIN=https://ocodejs.dev`
- Secrets: `SESSION_SECRET` (random, 48+ bytes), `TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

OAuth callback: `https://auth.ocodejs.dev/auth/github/callback`. Create a dedicated GitHub OAuth App and set this exact callback. Until its client ID and secret are configured, PAT login works and OAuth responds with a clear 503 status.

## Security

- GitHub tokens are encrypted using AES-256-GCM with a Worker secret key.
- Session identifiers and CSRF tokens are HMAC-SHA256 hashed before storage.
- Session cookie is Secure, HttpOnly, SameSite=Lax; the frontend and API share the `ocodejs.dev` site.
- Strict exact-origin CORS and Origin checks for credential-changing endpoints.
- OAuth state is random, single-use, expires after ten minutes, and is validated against an HttpOnly cookie.
- Auth endpoints are rate-limited per source IP using a hashed key.
- Request payload limits, fixed GitHub API origin, short upstream timeouts, no credential logging, and generic internal errors.
- Disconnect deletes stored encrypted credentials and all sessions. It does not revoke a PAT at GitHub; revoke it separately in GitHub Settings.

## Deployment

1. Create the D1 database and apply `migrations/0001_init.sql`.
2. Upload this module as Worker `ocodejs-auth` with D1 binding `DB`.
3. Set the variables and secrets listed above through Cloudflare's secret management API/dashboard.
4. Attach custom domain `auth.ocodejs.dev` to this Worker.
5. Verify `GET /health`, `GET /auth/session`, OAuth callback and PAT connection.
6. Keep the existing `ocodejs-cli` Worker and all `app` / `mcp` DNS records unchanged.

Cloudflare D1 is available on Free and Paid plans. Free-plan daily query limits apply; monitor usage and do not enable paid billing for this project.
