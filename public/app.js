const btn = document.querySelector('#rdv-btn');
const panel = document.querySelector('#rdv-panel');
const slotsTable = document.querySelector('#slots tbody');
const form = document.querySelector('#rdv-form');
const emailInput = document.querySelector('#email');
const alertBox = document.querySelector('#alert');
let selectedSlotId = null;

btn.addEventListener('click', async () => {
  panel.classList.remove('hidden');
  btn.disabled = true;
  await loadSlots();
});

async function loadSlots(){
  const r = await fetch('/api/slots');
  const { data=[] } = await r.json();
  const rows = data.map(s => {
    const start = new Date(s.startISO);
    const end = new Date(s.endISO);
    const label = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–${end.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    const disabled = s.taken ? 'disabled' : '';
    const status = s.taken ? '<span class="badge">belegt</span>' : '<span class="badge green">frei</span>';
    return `<tr>
      <td>${label}</td>
      <td>${status}</td>
      <td style="text-align:right"><button class="btn" data-id="${s.id}" ${disabled}>wählen</button></td>
    </tr>`;
  }).join('');
  slotsTable.innerHTML = rows;

  slotsTable.querySelectorAll('button[data-id]').forEach(b => {
    b.addEventListener('click', () => {
      selectedSlotId = b.getAttribute('data-id');
      document.querySelector('#chosen').textContent = new Date(selectedSlotId).toLocaleString();
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