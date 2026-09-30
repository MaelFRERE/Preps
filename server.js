import express from "express";
import pg from "pg";
import webpush from "web-push";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const publicKey = process.env.VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
if (publicKey && privateKey) webpush.setVapidDetails(subject, publicKey, privateKey);

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminder_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      reminder_hour INTEGER NOT NULL DEFAULT 8,
      reminder_minute INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    INSERT INTO reminder_settings (id, reminder_hour, reminder_minute, timezone)
    VALUES (1, 8, 0, 'Europe/Paris')
    ON CONFLICT (id) DO NOTHING;
  `);
}

app.get("/api/config", async (_req, res) => {
  const settings = await pool.query("SELECT reminder_hour, reminder_minute, timezone FROM reminder_settings WHERE id = 1");
  res.json({
    vapidPublicKey: publicKey,
    reminder: settings.rows[0] || { reminder_hour: 8, reminder_minute: 0, timezone: "Europe/Paris" }
  });
});

app.post("/api/subscribe", async (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: "Invalid subscription" });
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, subscription)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription`,
    [sub.endpoint, JSON.stringify(sub)]
  );
  res.json({ ok: true });
});

app.post("/api/settings", async (req, res) => {
  const hour = Math.max(0, Math.min(23, Number(req.body.hour)));
  const minute = Math.max(0, Math.min(59, Number(req.body.minute)));
  const timezone = String(req.body.timezone || "Europe/Paris");
  await pool.query(
    `UPDATE reminder_settings
     SET reminder_hour=$1, reminder_minute=$2, timezone=$3, updated_at=NOW()
     WHERE id=1`,
    [hour, minute, timezone]
  );
  res.json({ ok: true });
});

app.post("/api/test-push", async (_req, res) => {
  if (!publicKey || !privateKey) return res.status(500).json({ error: "VAPID keys missing" });
  const rows = (await pool.query("SELECT endpoint, subscription FROM push_subscriptions")).rows;
  const payload = JSON.stringify({
    title: "TriPlan 70.3",
    body: "Notification test : les rappels sont bien activés.",
    url: "/"
  });
  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [row.endpoint]);
      }
    }
  }
  res.json({ ok: true, sent });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

initDb()
  .then(() => app.listen(process.env.PORT || 3000, () => console.log("TriPlan server running")))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });