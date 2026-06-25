import fetch from 'node-fetch';

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const EMAILJS_KEY     = process.env.EMAILJS_KEY;
const EMAILJS_SERVICE  = 'service_3elr6xr';
const EMAILJS_TEMPLATE = 'template_er1ip0h';

// E-Mail-Adressen der Empfänger – hier beide eintragen
const RECIPIENTS = [
  'matthiasberthel@googlemail.com',
  'reer.sarah@gmail.com'
];

// ── Heute und morgen als deutsche Datumsstrings ──
function toDE(date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const today    = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

const todayStr    = toDE(today);
const tomorrowStr = toDE(tomorrow);

// ── Firebase lesen ──
async function loadItems() {
  const res  = await fetch(`${FIREBASE_DB_URL}/items.json`);
  const data = await res.json();
  if (!data) return [];
  return Object.values(data);
}

// ── E-Mail via EmailJS REST API ──
async function sendEmail(to, remindersText) {
  const body = {
    service_id:  EMAILJS_SERVICE,
    template_id: EMAILJS_TEMPLATE,
    user_id:     EMAILJS_KEY,
    template_params: {
      to_email:  to,
      reminders: remindersText
    }
  };

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });

  if (res.ok) {
    console.log(`✅ E-Mail gesendet an ${to}`);
  } else {
    const text = await res.text();
    console.error(`❌ Fehler bei ${to}:`, text);
  }
}

// ── Hauptlogik ──
async function main() {
  console.log(`📅 Prüfe Erinnerungen für heute (${todayStr}) und morgen (${tomorrowStr})…`);

  const items = await loadItems();
  const open  = items.filter(i => !i.done && i.date);

  const reminders = [];

  for (const item of open) {
    // Firebase speichert das Datum als YYYY-MM-DD
    const d   = new Date(item.date + 'T12:00:00');
    const str = toDE(d);

    if (str === todayStr) {
      reminders.push(`🔴 HEUTE: „${item.title}" (eingetragen von ${item.by})`);
    } else if (str === tomorrowStr) {
      reminders.push(`🟡 MORGEN: „${item.title}" (eingetragen von ${item.by})`);
    }
  }

  if (reminders.length === 0) {
    console.log('ℹ️ Keine Erinnerungen für heute oder morgen.');
    return;
  }

  const remindersText = reminders.join('\n');
  console.log('📬 Versende:\n' + remindersText);

  for (const email of RECIPIENTS) {
    await sendEmail(email, remindersText);
  }
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
