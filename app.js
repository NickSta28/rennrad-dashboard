import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { parseRows, summary, runImport } from './import.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const root = document.getElementById('app');
const de = (n, d = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// PostgREST liefert höchstens 1000 Zeilen pro Abruf: seitenweise holen
export async function fetchAll(table, cols = '*', order = 'id') {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb.schema('rad').from(table).select(cols).order(order).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...data); if (data.length < size) break;
  }
  return out;
}

function loginView(msg = '') {
  root.innerHTML = `<h1>Rennrad Dashboard</h1><div class="sub">Privater Zugang</div>
  <form class="card" id="f"><h2>Anmelden</h2>
    <label for="em">E-Mail</label><input id="em" type="email" autocomplete="username" required>
    <label for="pw">Passwort</label><input id="pw" type="password" autocomplete="current-password" required>
    ${msg ? `<div class="err" role="alert">${esc(msg)}</div>` : ''}
    <button type="submit">Anmelden</button></form>`;
  root.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: root.querySelector('#em').value.trim(), password: root.querySelector('#pw').value });
    if (error) loginView('Anmeldung fehlgeschlagen: ' + error.message); else homeView();
  };
}

async function stats() {
  const rides = await fetchAll('rides', 'id,km,avg_hr,datum');
  const km = rides.reduce((s, r) => s + Number(r.km || 0), 0);
  const last = rides.reduce((m, r) => (r.datum > m ? r.datum : m), '');
  return { n: rides.length, km, hr: rides.filter((r) => r.avg_hr).length, last };
}

async function homeView() {
  root.innerHTML = `<div class="top"><div><div class="sub">Phase 1 · Daten</div><h1>Rennrad Dashboard</h1></div><button class="ghost" id="out">Abmelden</button></div>
  <div class="card"><h2>Datenstand</h2><div id="st" class="sub">Wird geladen …</div></div>
  <div class="card"><h2>Rohdatei importieren</h2>
    <div class="sub">Die Datei wird nur in deinem Browser gelesen und unter deinem Login gespeichert.</div>
    <label for="file">Excel-Datei (Blatt „Datenbank_fix“)</label><input id="file" type="file" accept=".xlsx">
    <div id="pre"></div>
    <label class="check"><input type="checkbox" id="rep"> Vorhandene Rad-Daten vorher löschen und ersetzen</label>
    <button id="go" disabled>Importieren</button><div id="msg"></div></div>`;
  root.querySelector('#out').onclick = async () => { await sb.auth.signOut(); loginView(); };
  const st = root.querySelector('#st');
  try {
    const s = await stats();
    st.innerHTML = s.n ? `<dl><dt>Fahrten</dt><dd>${de(s.n)}</dd><dt>Kilometer</dt><dd>${de(s.km, 1)}</dd><dt>Fahrten mit Puls</dt><dd>${de(s.hr)}</dd><dt>Letzte Fahrt</dt><dd>${esc(s.last)}</dd></dl>` : 'Noch keine Fahrten. Importiere unten die Rohdatei.';
  } catch (e) { st.innerHTML = `<div class="err" role="alert">Datenbank nicht erreichbar: ${esc(e.message)}<br>Falls es um das Schema „rad“ geht: unter Integrations → Data API → Exposed schemas ergänzen.</div>`; }

  let parsed = null; const go = root.querySelector('#go'); const pre = root.querySelector('#pre'); const msg = root.querySelector('#msg');
  root.querySelector('#file').onchange = async (e) => {
    parsed = null; go.disabled = true; msg.innerHTML = ''; pre.innerHTML = '';
    const f = e.target.files[0]; if (!f) return;
    try {
      if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('Leser konnte nicht geladen werden')); document.head.append(s); });
      const wb = window.XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets['Datenbank_fix'] || wb.Sheets[wb.SheetNames[0]];
      parsed = parseRows(window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }));
      const s = summary(parsed);
      pre.innerHTML = `<div class="ok"><b>${de(s.fahrten)}</b> Fahrten · <b>${de(s.km, 1)}</b> km · <b>${de(s.mitPuls)}</b> mit Puls · <b>${s.wechsel}</b> Wechsel${s.hinweise ? ` · ${s.hinweise} Hinweise` : ''}</div>${parsed.warn.length ? `<div class="err">${parsed.warn.map(esc).join('<br>')}</div>` : ''}`;
      go.disabled = false;
    } catch (err) { pre.innerHTML = `<div class="err" role="alert">${esc(err.message)}</div>`; }
  };
  go.onclick = async () => {
    go.disabled = true; msg.innerHTML = '';
    try {
      const r = await runImport(sb, parsed, { replace: root.querySelector('#rep').checked, onProgress: (t) => { msg.innerHTML = `<div class="sub">${esc(t)}</div>`; } });
      msg.innerHTML = `<div class="ok">Fertig: ${de(r.rides)} Fahrten, ${r.bikes} Räder, ${r.wheelsets} Laufradsätze, ${r.changes} Wechsel.</div>`;
      const s = await stats(); st.innerHTML = `<dl><dt>Fahrten</dt><dd>${de(s.n)}</dd><dt>Kilometer</dt><dd>${de(s.km, 1)}</dd><dt>Fahrten mit Puls</dt><dd>${de(s.hr)}</dd><dt>Letzte Fahrt</dt><dd>${esc(s.last)}</dd></dl>`;
    } catch (err) { msg.innerHTML = `<div class="err" role="alert">${esc(err.message)}</div>`; go.disabled = false; }
  };
}

const { data } = await sb.auth.getSession();
if (data.session) homeView(); else loginView();
