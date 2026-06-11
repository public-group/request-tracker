# Deploying to Cloudflare

This app deploys as a **single Cloudflare Worker** that serves the React SPA
(static assets) and handles the `/api/health` and `/api/send-email` routes.

## One-time setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Log in to Cloudflare (opens a browser):
   ```bash
   npx wrangler login
   ```

## Deploy

```bash
npm run cf:deploy
```

That runs `vite build` and then `wrangler deploy`. When it finishes, Wrangler
prints your live URL (e.g. `https://nexus-request-system.<your-subdomain>.workers.dev`).

## Email sending (optional)

`/api/send-email` works without any key — it just simulates the send. To send
real email via Resend, set the secret once:

```bash
npx wrangler secret put RESEND_API_KEY
# optional custom sender:
npx wrangler secret put RESEND_FROM_EMAIL
```

Re-deploy afterward (`npm run cf:deploy`).

## Local preview against the Workers runtime

```bash
npm run cf:preview     # builds, then runs `wrangler dev`
```

(Your existing `npm run dev` still works for the Vite/Express dev server.)

## Notes

- `wrangler.jsonc` holds the config. Rename the Worker by changing `"name"`.
- The Firebase web config in `firebase-applet-config.json` is a public client
  config and is safe to ship. Access is controlled by `firestore.rules` — make
  sure those rules are published in your Firebase project.
- Add a custom domain from the Cloudflare dashboard:
  Workers & Pages → your Worker → Settings → Domains & Routes.

## Alternative: pure static (no API)

If you don't need the email route, you can skip the Worker entirely and deploy
just the static build:

```bash
npm run cf:build      # produces ./dist
npx wrangler pages deploy dist
```

The in-app email buttons will return 404 in that mode, but the rest of the app
(Firebase-backed) works normally.
