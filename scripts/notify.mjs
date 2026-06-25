import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const GMAIL_USER      = process.env.GMAIL_USER;
const GMAIL_APP_PW    = process.env.GMAIL_APP_PW;
const RECIPIENT_2     = process.env.RECIPIENT_2;

const RECIPIENTS = [GMAIL_USER, RECIPIENT_2].filter(Boolean);

const catLabel = { reisen:'✈️ Reisen', abenteuer:'🧗 Abenteuer', essen:'🍽️ Essen', kultur:'🎭 Kultur', lernen:'📚 Lernen', sonstiges:'✨ Sonstiges' };

// ── Firebase helpers ──
async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  return res.json();
}
async function fbDelete(path) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: 'DELETE' });
}
async function fbSet(path, data) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
}

// ── Send email ──
const transporter = nodemailer.createTransport({ service:'gmail', auth:{ user:GMAIL_USER, pass:GMAIL_APP_PW } });

async function sendEmail(subject, html) {
  for (const to of RECIPIENTS) {
    const info = await transporter.sendMail({
      from: `"Bucket List 🗺️" <${GMAIL_USER}>`, to, subject, html
    });
    console.log(`✅ E-Mail gesendet an ${to} (${info.messageId})`);
  }
}

function emailHTML(icon, headline, body) {
  return `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#F7F3EE;border-radius:12px">
    <h2 style="font-size:22px;color:#1C1A18;margin-bottom:8px">${icon} ${headline}</h2>
    ${body}
    <p style="color:#5C5751;font-size:12px;margin-top:24px">Eure gemeinsame Bucket List</p>
  </div>`;
}

// ── Main ──
async function main() {
  const notifications = await fbGet('notifications');
  if (!notifications) { console.log('ℹ️ Keine neuen Benachrichtigungen.'); return; }

  const pending = Object.entries(notifications)
    .filter(([,n]) => !n.sent)
    .sort(([a],[b]) => a - b);

  if (!pending.length) { console.log('ℹ️ Keine ungesendeten Benachrichtigungen.'); return; }

  console.log(`📬 ${pending.length} Benachrichtigung(en) gefunden.`);

  for (const [id, n] of pending) {
    try {
      if (n.type === 'new_item') {
        const { title, by, cat } = n.payload;
        const label = catLabel[cat] || cat;
        const html = emailHTML('✨', 'Neuer Wunsch hinzugefügt',
          `<div style="background:white;border-radius:8px;padding:18px;border-left:4px solid #B8966A">
            <p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#1C1A18">${title}</p>
            <p style="margin:0;font-size:13px;color:#5C5751">Kategorie: ${label} &nbsp;·&nbsp; Hinzugefügt von <strong>${by}</strong></p>
          </div>`);
        await sendEmail(`✨ Neuer Wunsch: „${title}"`, html);

      } else if (n.type === 'new_comment') {
        const { itemTitle, comment, by } = n.payload;
        const html = emailHTML('💬', `Neuer Kommentar zu „${itemTitle}"`,
          `<div style="background:white;border-radius:8px;padding:18px;border-left:4px solid #7A9E8E">
            <p style="margin:0 0 6px;font-size:15px;font-style:italic;color:#1C1A18">"${comment}"</p>
            <p style="margin:0;font-size:13px;color:#5C5751">Von <strong>${by}</strong></p>
          </div>`);
        await sendEmail(`💬 Neuer Kommentar von ${by}`, html);
      }

      // Mark as sent
      await fbSet(`notifications/${id}/sent`, true);

    } catch (err) {
      console.error(`❌ Fehler bei Benachrichtigung ${id}:`, err.message);
    }
  }

  // Clean up old sent notifications (älter als 24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, n] of Object.entries(notifications)) {
    if (n.sent && parseInt(id) < cutoff) {
      await fbDelete(`notifications/${id}`);
    }
  }
}

main().catch(err => { console.error('Unerwarteter Fehler:', err); process.exit(1); });
