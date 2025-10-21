import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

let slots = [];
function seedSlots(days = 5) {
  slots = [];
  const now = new Date();
  for (let d = 0; d < days; d++) {
    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, 0, 0);
      const end = new Date(start.getTime() + 45*60000);
      const id = `${start.toISOString()}`;
      slots.push({ id, startISO: start.toISOString(), endISO: end.toISOString(), taken: false });
    }
  }
}
seedSlots();

app.get("/api/slots", (req, res) => {
  res.json({ ok: true, data: slots });
});

app.post("/api/book", async (req, res) => {
  const { slotId, email } = req.body || {};
  if (!slotId || !email) return res.status(400).json({ ok: false, error: "slotId and email required" });
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return res.status(404).json({ ok: false, error: "slot not found" });
  if (slot.taken) return res.status(409).json({ ok: false, error: "slot already taken" });
  slot.taken = true; slot.email = email;

  try {
    const start = new Date(slot.startISO);
    const end = new Date(slot.endISO);
    const when = start.toLocaleString();

    await Promise.all([
      transporter.sendMail({
        from: `RDV <${process.env.SMTP_USER || "noreply@example.com"}>`,
        to: email,
        subject: "Terminbestätigung",
        html: `<p>Ihr Termin ist bestätigt:</p><p><b>${when}</b></p><p>Adresse: 6, Avenue Guillaume, L-1650 Luxembourg</p><p><a href="${BASE_URL}">Website</a></p>`
      }),
      transporter.sendMail({
        from: `RDV <${process.env.SMTP_USER || "noreply@example.com"}>`,
        to: ADMIN_EMAIL,
        subject: "Neuer Termin gebucht",
        html: `<p>Email: ${email}</p><p>Start: ${start.toISOString()}</p><p>Ende: ${end.toISOString()}</p>`
      })
    ]);
  } catch(e) {
    console.error("Mail error:", e?.message || e);
  }

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("http://localhost:"+PORT));