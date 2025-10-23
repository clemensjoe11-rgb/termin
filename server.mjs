import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));
app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.MONGO_URI;
let client, col;

async function connectMongo() {
  if (col) return col;
  if (!uri) {
    console.warn('MONGO_URI not set. Running without DB.');
    return null;
  }
  client = new MongoClient(uri);
  await client.connect();
  const db = client.db('termin');
  col = db.collection('bookings');
  await col.createIndex({ startISO: 1 }, { unique: true }).catch(()=>{});
  return col;
}

// Helpers
function buildSlots(startHour=8, endHour=17, stepMin=30, days=7) {
  const out = [];
  const now = new Date();
  const base = new Date(now); base.setHours(0,0,0,0);
  for (let d=0; d<days; d++) {
    const day0 = new Date(base.getTime()+d*86400000);
    for (let h=startHour; h<endHour; h++) {
      for (let m=0; m<60; m+=stepMin) {
        const s = new Date(day0); s.setHours(h,m,0,0);
        const e = new Date(s.getTime()+stepMin*60000);
        out.push({
          id: s.toISOString(),
          startISO: s.toISOString(),
          endISO: e.toISOString(),
        });
      }
    }
  }
  return out;
}

// GET slots
app.get('/api/slots', async (req,res) => {
  const slots = buildSlots();
  let taken = new Set();
  const collection = await connectMongo();
  if (collection) {
    const minISO = new Date().toISOString();
    const docs = await collection.find({ startISO: { $gte: minISO }}, { projection: { startISO:1, _id:0 }}).toArray();
    taken = new Set(docs.map(d=>d.startISO));
  }
  const now = Date.now();
  res.json({ ok:true, data: slots.map(s => ({
    ...s,
    taken: taken.has(s.startISO),
    past: new Date(s.endISO).getTime() <= now
  }))});
});

// POST booking
app.post('/api/book', async (req,res) => {
  const {
    slotId, firstName, lastName, email, gender, phone, countryCode, birthDate
  } = req.body || {};

  if (!slotId || !email || !firstName || !lastName) {
    return res.status(400).json({ ok:false, error:'Missing required fields.' });
  }
  const start = new Date(slotId);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ ok:false, error:'Invalid slotId.' });
  }
  const end = new Date(start.getTime()+30*60000);

  const doc = {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    firstName, lastName, email, gender: gender||null,
    phone: phone||null, countryCode: countryCode||null,
    birthDate: birthDate||null,
    createdAt: new Date().toISOString()
  };

  const collection = await connectMongo();
  if (!collection) {
    return res.json({ ok:true, note:'DB not configured. Skipped persist.', data: doc });
  }
  try {
    await collection.insertOne(doc);
    res.json({ ok:true, data: doc });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ ok:false, error:'Slot already booked.' });
    }
    console.error(e);
    res.status(500).json({ ok:false, error:'DB error' });
  }
});

// Fallback to index
app.get('*', (_,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('Server listening on http://localhost:'+port));
