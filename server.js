import express from "express";
import { MongoClient } from "mongodb";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// --- ENV
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "termin";
const COLLECTION = process.env.COLLECTION || "appointments";

// --- Mongo
let client, col;
async function initMongo() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI fehlt");
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(DB_NAME);
  col = db.collection(COLLECTION);
  // eindeutiger Slot
  await col.createIndex({ startISO: 1 }, { unique: true });
}
initMongo().catch(err => {
  console.error("Mongo init failed:", err.message);
});

// --- API
app.get("/api/health", (req, res) => {
  res.json({ ok: true, mongo: !!col });
});

app.get("/api/slots", async (req, res) => {
  try {
    if (!col) throw new Error("db down");
    // Nur gebuchte Slots zurückgeben
    const rows = await col
      .find({}, { projection: { _id: 0, startISO: 1, endISO: 1, taken: 1 } })
      .toArray();
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(503).json({ ok: false, error: "DB nicht erreichbar" });
  }
});

app.post("/api/book", async (req, res) => {
  try {
    if (!col) throw new Error("db down");
    const {
      firstName, lastName, email, gender, phone, countryCode,
      birthDate, startISO, endISO
    } = req.body || {};

    // Minimalvalidierung
    if (!firstName || !lastName || !email || !startISO || !endISO) {
      return res.status(400).json({ ok: false, error: "Ungültige Daten" });
    }

    const doc = {
      firstName, lastName, email, gender, phone, countryCode, birthDate,
      startISO, endISO, taken: true, createdAt: new Date()
    };

    await col.updateOne(
      { startISO },
      { $setOnInsert: doc },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (e) {
    if (String(e?.message || "").includes("E11000")) {
      return res.status(409).json({ ok: false, error: "Slot bereits belegt" });
    }
    console.error("POST /api/book", e.message);
    res.status(503).json({ ok: false, error: "Technische Störung" });
  }
});

// --- statische Dateien (Frontend)
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.listen(PORT, () => console.log("Server running on", PORT));
