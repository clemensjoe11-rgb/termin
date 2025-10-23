import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { MongoClient } from 'mongodb';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// Mongo
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'termin';
const colName = process.env.COLLECTION || 'bookings';

let client, col;

async function connectDB() {
  client = new MongoClient(uri);
  await client.connect();
  col = client.db(dbName).collection(colName);
}
connectDB().catch(err => {
  console.error('DB connect failed:', err.message);
});

// API
app.get('/api/health', (_req, res) => {
  const ok = !!col;
  res.status(ok ? 200 : 503).json({ ok, db: ok ? 'connected' : 'down' });
});

app.get('/api/slots', async (_req, res) => {
  try {
    if (!col) return res.status(503).json({ ok: false, error: 'db_down' });
    const docs = await col
      .find({ taken: true }, { projection: { _id: 0, startISO: 1, endISO: 1, taken: 1 } })
      .toArray();
    res.json({ ok: true, data: docs });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/book', async (req, res) => {
  try {
    if (!col) return res.status(503).json({ ok: false, error: 'db_down' });

    const {
      firstName, lastName, email, gender, phone, countryCode,
      birthDate, startISO, endISO, taken
    } = req.body || {};

    if (!firstName || !lastName || !email || !birthDate || !startISO)
      return res.status(400).json({ ok: false, error: 'missing_fields' });

    // doppelte Buchung vermeiden
    const exists = await col.findOne({ startISO });
    if (exists) return res.status(409).json({ ok: false, error: 'already_booked' });

    await col.insertOne({
      firstName, lastName, email, gender, phone, countryCode,
      birthDate, startISO, endISO, taken: !!taken, createdAt: new Date()
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Static Frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('listening on', port));
