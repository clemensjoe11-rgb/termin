import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Mongo ---
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://gomdi:<db_password>@termin.w61ykad.mongodb.net/?retryWrites=true&w=majority&appName=termin";
const DB_NAME = process.env.DB_NAME || "termin";
const COL = "appointments";

let client, col;

async function initDb() {
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  col = db.collection(COL);
  // eindeutiger Slot
  await col.createIndex({ startISO: 1 }, { unique: true });
  // häufigste Abfragen
  await col.createIndex({ startISO: 1, endISO: 1 });
}
initDb().catch((e) => {
  console.error("DB init failed:", e.message);
});

app.use(express.json());
app.use(express.static("public"));

// Health
app.get("/api/health", (_req, res) => {
  const ok = !!col;
  res.status(ok ? 200 : 503).json({ ok });
});

// Slots für UI: gibt nur belegte Startzeiten zurück (leichtgewichtig)
app.get("/api/slots", async (req, res) => {
  try {
    if (!col) throw new Error("no-db");
    // optional: Zeitraum filtern
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const q = {};
    if (from || to) {
      q.startISO = {};
      if (from) q.startISO.$gte = from.toISOString();
      if (to) q.startISO.$lt = to.toISOString();
    }

    const taken = await col
      .find(q, { projection: { _id: 0, startISO: 1, endISO: 1 } })
      .toArray();

    res.json({
      ok: true,
      data: taken.map((t) => ({ startISO: t.startISO, endISO: t.endISO, taken: true }))
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: "Technische Störung: DB nicht erreichbar." });
  }
});

// Buchen
app.post("/api/book", async (req, res) => {
  try {
    if (!col) throw new Error("no-db");

    const {
      firstName,
      lastName,
      email,
      gender,
      countryCode,
      phone,
      birthDate,
      slotId // ISO-String
    } = req.body || {};

    // Minimal-Validierung
    if (!slotId || !firstName || !lastName || !email || !birthDate || !gender) {
      return res.status(400).json({ ok: false, error: "Eingaben unvollständig." });
    }

    const start = new Date(slotId);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ ok: false, error: "Ungültiger Slot." });
    }
    const end = new Date(start.getTime() + 30 * 60000); // 30min Slot

    const doc = {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      firstName,
      lastName,
      email,
      gender,
      countryCode,
      phone,
      birthDate,
      createdAt: new Date().toISOString()
    };

    await col.insertOne(doc); // unique Index verhindert Doppeltbuchung

    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 11000) {
      // unique collision
      return res.status(409).json({ ok: false, error: "Dieser Termin wurde gerade vergeben." });
    }
    res
      .status(503)
      .json({ ok: false, error: "Technische Störung: Verbindung zur Datenbank fehlgeschlagen." });
  }
});

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
