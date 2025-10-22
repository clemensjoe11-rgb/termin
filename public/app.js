const btn = document.querySelector('#rdv-btn');
const panel = document.querySelector('#rdv-panel');
const slotsTable = document.querySelector('#slots tbody');
const form = document.querySelector('#rdv-form');
const emailInput = document.querySelector('#email');
const alertBox = document.querySelector('#alert');
const nowEl = document.querySelector('#now');
let selectedSlotId = null;

const DAY_START = "08:00";
const DAY_END   = "17:00";
const SLOT_MIN  = 30;

btn.addEventListener('click', async () => {
  panel.classList.remove('hidden');
  btn.disabled = true;
  await loadSlots();
});

/* Live-Uhr */
function tickNow() {
  const n = new Date();
  nowEl.textContent = n.toLocaleString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}
tickNow();
setInterval(tickNow, 1000);

/* Provisorische Slots für HEUTE (08:00–17:00, alle 30 Min) */
function makeLocalSlots() {
  const [sh, sm] = DAY_START.split(':').map(Number);
  const [eh, em] = DAY_END.split(':').map(Number);
  const start = new Date(); start.setHours(sh, sm, 0, 0);
  const end   = new Date(); end.setHours(eh, em, 0, 0);

  const out = [];
  for (let t = new Date(start); t < end; t = new Date(t.getTime() + SLOT_MIN*60000)) {
    const tEnd = new Date(t.getTime() + SLOT_MIN*60000);
    out.push({
      id: t.toISOString(),
      startISO: t.toISOString(),
      endISO: tEnd.toISOString(),
      taken: false
    });
  }
  return out;
}

async function fetchServerSlots() {
  try {
    const r = await fetch('/api/slots');
    if (!r.ok) throw new Error('HTTP '+r.status);
    const js = await r.json();
    return Array.isArray(js?.data) ? js.data : [];
  } catch {
    return [];
  }
}

async function loadSlots(){
  let data = await fetchServerSlots();
  if (data.length === 0) data = makeLocalSlots();

  const now = Date.now();

  const rows = data.map(s => {
    const start = new Date(s.startISO);
    const end = new Date(s.endISO);
    const labelDate = start.toLocaleDateString();
    const labelTime = `${start.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–${end.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;

    const isPast = end.getTime() <= now;
    const isTaken = !!s.taken;
    const disabled = (isTaken || isPast) ? 'disabled' : '';
    const status = isTaken
      ? '<span class="badge">belegt</span>'
      : (isPast ? '<span class="badge">vorbei</span>' : '<span class="badge green">frei</span>');
    const trCls = isPast ? 'class="past"' : '';

    return `<tr ${trCls}>
      <td>${labelDate} ${labelTime}</td>
      <td>${status}</td>
      <td style="text-align:right"><button class="btn" data-id="${s.id}" ${disabled}>wählen</button></td>
    </tr>`;
  }).join('');

  slotsTable.innerHTML = rows;

  slotsTable.querySelectorAll('button[data-id]').forEach(b => {
    b.addEventListener('click', () => {
      selectedSlotId = b.getAttribute('data-id');
      const d = new Date(selectedSlotId);
      document.querySelector('#chosen').textContent =
        `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
      document.querySelector('#confirm').classList.remove('hidden');
      alertBox.textContent = '';
      alertBox.className = '';
    });
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedSlotId) {
    alertBox.textContent = 'Bitte zuerst einen Termin wählen.';
    alertBox.className = 'error';
    return;
  }
  const email = emailInput.value.trim();
  if (!email) {
    alertBox.textContent = 'Bitte E-Mail eingeben.';
    alertBox.className = 'error';
    return;
  }
  try {
    const r = await fetch('/api/book', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ slotId: selectedSlotId, email })
    });
    const js = await r.json();
    if (!js.ok) throw new Error(js.error || 'Fehler');
    alertBox.textContent = 'Termin bestätigt. Bestätigungs-E-Mail gesendet.';
    alertBox.className = 'success';
    emailInput.value = '';
    await loadSlots();
  } catch (err) {
    alertBox.textContent = 'Fehler: ' + err.message;
    alertBox.className = 'error';
  }
});

/* Alle 60 Sek neu laden, damit Durchstreichung „mitgeht“ */
setInterval(loadSlots, 60000);
