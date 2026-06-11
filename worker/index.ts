/**
 * Cloudflare Worker entry point for the Nexus Request System.
 *
 * Serves the Vite-built SPA from static assets (the `ASSETS` binding) and
 * handles the two API routes that previously lived in the Express `server.ts`:
 *   - GET  /api/health
 *   - POST /api/send-email   (proxies to Resend, keeping the API key server-side)
 *
 * Any request that isn't an API route falls through to static assets. With
 * `not_found_handling: "single-page-application"` configured in wrangler.jsonc,
 * unknown client-side routes are served index.html so React Router works.
 */

export interface Env {
  ASSETS: Fetcher;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- Health check ---
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    }

    // --- Send email proxy (keeps RESEND_API_KEY off the client) ---
    if (url.pathname === "/api/send-email") {
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let body: {
        to?: string;
        subject?: string;
        html?: string;
        text?: string;
      };
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body." }, { status: 400 });
      }

      const { to, subject, html, text } = body;
      if (!to || !subject || (!html && !text)) {
        return Response.json(
          { error: "Missing required fields: to, subject, and body (html or text)." },
          { status: 400 }
        );
      }

      const apiKey = env.RESEND_API_KEY;

      // No key configured -> simulate (mirrors the original Express fallback).
      if (!apiKey) {
        return Response.json({
          message:
            "Email simulated successfully (no RESEND_API_KEY set). Set the secret to send for real.",
        });
      }

      try {
        const fromEmail =
          env.RESEND_FROM_EMAIL || "Nexus Requests <onboarding@resend.dev>";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ from: fromEmail, to, subject, html: html || text, text }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return Response.json(
            { error: "Failed to dispatch email via Resend Service.", details: errData },
            { status: 502 }
          );
        }

        const data = (await response.json()) as { id?: string };
        return Response.json({
          message: "Email sent successfully via Resend API",
          id: data.id,
        });
      } catch (err) {
        return Response.json(
          { error: "Email dispatch failed.", details: (err as Error).message },
          { status: 500 }
        );
      }
    }

    // --- Everything else: static assets / SPA fallback ---
    return env.ASSETS.fetch(request);
  },
};
