import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Send Email proxy with security rules preventing exposure of API keys
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, text } = req.body;
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: "Missing required fields: to, subject, and body (html or text)." });
    }

    console.log("\n========================================================");
    console.log(`[EMAIL DISPATCHER] Local Outbox Delivery`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("--------------------------------------------------------");
    console.log(`Body (Preview):\n${text || html?.replace(/<[^>]*>/g, '').substring(0, 300)}...`);
    console.log("========================================================\n");

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "Nexus Requests <onboarding@resend.dev>";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            from: fromEmail,
            to,
            subject,
            html: html || text,
            text
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error("[EMAIL ERROR] Resend dispatch failed:", errData);
          return res.status(500).json({ error: "Failed to dispatch email via Resend Service.", details: errData });
        }

        const data = await response.json();
        return res.status(200).json({ message: "Email sent successfully via Resend API", id: data.id });
      } catch (err: any) {
        console.error("[EMAIL ERROR] Error communicating with Resend:", err);
        return res.status(500).json({ error: "Email dispatch failed.", details: err.message });
      }
    }

    // fallback when RESEND_API_KEY is not defined
    res.status(200).json({ message: "Email simulated and dispatched to node outbox logs successfully (No API Key set)." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
