import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const FIREBASE_DB_URL  = process.env.FIREBASE_DB_URL;
const GMAIL_USER       = process.env.GMAIL_USER;
const GMAIL_APP_PW     = process.env.GMAIL_APP_PW;

// E-Mail-Adressen der Empfänger
const RECIPIENTS = [
  process.env.GMAIL_USER,          // deine eigene Adresse
  process.env.RECIPIENT_2          // E-Mail deiner Freundin
];

// ── Heute und morgen ──
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

// ── E-Mail senden ──
async function sendEmails(reminders) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PW
    }
  });

  const html = `
    <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#F7F3EE;border-radius:12px">
      <h2 style="font-size:22px;color:#1C1A18;margin-bottom:8px">📅 Bucket List Erinnerung</h2>
      <p style="color:#5C5751;font-size:14px;margin-bottom:24px">Folgende Erlebnisse stehen bald an:</p>
      ${reminders.map(r => `
        <div style="background:white;border-radius:8px;padding:14px 18px;margin-bottom:10px;border-left:4px solid ${r.startsWith('🔴') ? '#C4847A' : '#B8966A'}">
          <p style="margin:0;font-size:15px;color:#1C1A18">${r}</p>
        </div>
      `).join('')}
      <p style="color:#5C5751;font-size:12px;margin-top:24px">Eure gemeinsame Bucket List</p>
    </div>
  `;

  for (const to of RECIPIENTS) {
    if (!to) continue;
    const info = await transporter.sendMail({
      from:    `"Bucket List 🗺️" <${GMAIL_USER}>`,
      to,
      subject: `📅 Bucket List Erinnerung – ${todayStr}`,
      html
    });
    console.log(`✅ E-Mail gesendet an ${to} (${info.messageId})`);
  }
}

// ── Hauptlogik ──
async function main() {
  console.log(`📅 Prüfe Erinnerungen für heute (${todayStr}) und morgen (${tomorrowStr})…`);

  const items = await loadItems();
  const open  = items.filter(i => !i.done && i.date);

  const reminders = [];
  for (const item of open) {
    const d   = new Date(item.date + 'T12:00:00');
    const str = toDE(d);
    if (str === todayStr)    reminders.push(`🔴 HEUTE: „${item.title}" (von ${item.by})`);
    else if (str === tomorrowStr) reminders.push(`🟡 MORGEN: „${item.title}" (von ${item.by})`);
  }

  if (reminders.length === 0) {
    console.log('ℹ️ Keine Erinnerungen für heute oder morgen.');
    return;
  }

  console.log('📬 Versende:\n' + reminders.join('\n'));
  await sendEmails(reminders);
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
