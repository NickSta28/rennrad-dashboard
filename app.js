import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=5';
import { parseRows, summary, runImport } from './import.js?v=5';
import { overviewView, bikesView, ridesView, ridesList, activityView, settingsSheet, newView, de as _de } from './views.js?v=5';
import { years, DEFAULT_LIMITS } from './compute.js?v=5';
import { applyTheme, savedAccent, ACCENTS } from './theme.js?v=5';

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
  document.querySelector('nav')?.remove();
  root.innerHTML = `<h1>Rennrad Dashboard</h1><div class="sub">Privater Zugang</div>
  <form class="card" id="f"><h2>Anmelden</h2>
    <label for="em">E-Mail</label><input id="em" type="email" autocomplete="username" required>
    <label for="pw">Passwort</label><input id="pw" type="password" autocomplete="current-password" required>
    ${msg ? `<div class="err" role="alert">${esc(msg)}</div>` : ''}
    <button type="submit">Anmelden</button></form>`;
  root.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: root.querySelector('#em').value.trim(), password: root.querySelector('#pw').value });
    if (error) loginView('Anmeldung fehlgeschlagen: ' + error.message); else boot();
  };
}

async function stats() {
  const rides = await fetchAll('rides', 'id,km,avg_hr,datum');
  const km = rides.reduce((s, r) => s + Number(r.km || 0), 0);
  const last = rides.reduce((m, r) => (r.datum > m ? r.datum : m), '');
  return { n: rides.length, km, hr: rides.filter((r) => r.avg_hr).length, last };
}

async function dataView() {
  root.innerHTML = `<div class="top"><div><div class="sub">Daten · Version 27.11.-9</div><h1>Rennrad Dashboard</h1></div><button class="ghost" id="out">Abmelden</button></div>
  <div class="card"><h2>Datenstand</h2><div id="st" class="sub">Wird geladen …</div></div>
  <div class="card"><h2>Rohdatei importieren</h2>
    <div class="sub">Die Datei wird nur in deinem Browser gelesen und unter deinem Login gespeichert.</div>
    <label for="file">Excel-Datei (Blatt „Datenbank_fix“)</label><input id="file" type="file" accept=".xlsx">
    <div id="pre"></div>
    <label class="check"><input type="checkbox" id="rep"> Vorhandene Rad-Daten vorher löschen und ersetzen</label>
    <button id="go" disabled>Importieren</button><div id="msg"></div></div>`;
  root.querySelector('#out').onclick = async () => { await sb.auth.signOut(); state.db = null; document.querySelector('nav')?.remove(); loginView(); };
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
      state.db = null;
      const r = await runImport(sb, parsed, { replace: root.querySelector('#rep').checked, onProgress: (t) => { msg.innerHTML = `<div class="sub">${esc(t)}</div>`; } });
      msg.innerHTML = `<div class="ok">Fertig: ${de(r.rides)} Fahrten, ${r.bikes} Räder, ${r.wheelsets} Laufradsätze, ${r.changes} Wechsel.</div>`;
      const s = await stats(); st.innerHTML = `<dl><dt>Fahrten</dt><dd>${de(s.n)}</dd><dt>Kilometer</dt><dd>${de(s.km, 1)}</dd><dt>Fahrten mit Puls</dt><dd>${de(s.hr)}</dd><dt>Letzte Fahrt</dt><dd>${esc(s.last)}</dd></dl>`;
    } catch (err) { msg.innerHTML = `<div class="err" role="alert">${esc(err.message)}</div>`; go.disabled = false; }
  };
}


const state = { fy: 'alle', q: '', cmp: null, tab: 'uebersicht', year: null, bike: null, view: null, db: null, scroll: 0, user: null, settings: { accent: ACCENTS[0][1], limits: DEFAULT_LIMITS, goal: 4500 } };
const S = (v) => (v == null ? v : String(v));
async function load() {
  const [rides, bikes, wheelsets, links, changes] = await Promise.all([
    fetchAll('rides', '*', 'id'), fetchAll('bikes', '*', 'sort'), fetchAll('wheelsets', '*', 'id'),
    fetchAll('bike_wheelsets', '*', 'bike_id'), fetchAll('component_changes', '*', 'id')]);
  // IDs einheitlich als Text führen (Vergleiche mit data-Attributen)
  rides.forEach((r) => { r.id = S(r.id); r.bike_id = S(r.bike_id); r.wheelset_id = S(r.wheelset_id); });
  bikes.forEach((b) => { b.id = S(b.id); }); wheelsets.forEach((w) => { w.id = S(w.id); });
  links.forEach((l) => { l.bike_id = S(l.bike_id); l.wheelset_id = S(l.wheelset_id); });
  changes.forEach((c) => { c.bike_id = S(c.bike_id); c.wheelset_id = S(c.wheelset_id); });
  const { data: st } = await sb.schema('rad').from('settings').select('*').maybeSingle();
  if (st) state.settings = { accent: st.accent || state.settings.accent, limits: { ...DEFAULT_LIMITS, ...(st.limits || {}) }, goal: st.goals?.year || 4500 };
  state.db = { rides, bikes, wheelsets, links, changes };
  applyTheme(state.settings.accent);
}
let saveTimer = null;
function persistSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { data: { session } } = await sb.auth.getSession();
    const { error } = await sb.schema('rad').from('settings').upsert({ user_id: session.user.id, accent: state.settings.accent, limits: state.settings.limits, goals: { year: state.settings.goal } }, { onConflict: 'user_id' });
    const e = document.getElementById('sherr'); if (e) e.innerHTML = error ? `<div class="err" role="alert">Speichern fehlgeschlagen: ${esc(error.message)}</div>` : '';
  }, 500);
}

const TABS = [['uebersicht', 'Übersicht'], ['raeder', 'Räder'], ['fahrten', 'Fahrten'], ['daten', 'Daten']];
function tabbar() {
  document.querySelector('nav')?.remove();
  const n = document.createElement('nav'); n.setAttribute('aria-label', 'Hauptmenü');
  n.innerHTML = TABS.map(([k, l]) => `<button class="${k === state.tab && !state.view ? 'on' : ''}" data-t="${k}"${k === state.tab ? ' aria-current="page"' : ''}>${l}</button>`).join('');
  n.querySelectorAll('button').forEach((b) => { b.onclick = () => { state.tab = b.dataset.t; state.view = null; shell(); window.scrollTo(0, 0); }; });
  document.body.append(n);
}

function openRide(id) { state.scroll = window.scrollY; state.view = { type: 'ride', id: String(id) }; shell(); window.scrollTo(0, 0); }
function closeView() { state.view = null; shell(); window.scrollTo(0, state.scroll); }

async function shell() {
  if (state.tab === 'daten' && !state.view) { await dataView(); tabbar(); return; }
  if (!state.db) {
    root.innerHTML = '<div class="sub">Wird geladen …</div>';
    try { await load(); } catch (e) { root.innerHTML = `<div class="err" role="alert">Datenbank nicht erreichbar: ${esc(e.message)}</div>`; return; }
  }
  const d = state.db; const today = new Date(); const lim = state.settings.limits;
  if (state.view?.type === 'ride') {
    const r = d.rides.find((x) => x.id === state.view.id);
    if (!r) { state.view = null; return shell(); }
    root.innerHTML = activityView(r, d.bikes, d.wheelsets); tabbar();
    root.querySelector('#back').onclick = closeView; return;
  }
  if (state.view?.type === 'new') { root.innerHTML = newView(d.bikes, d.wheelsets, d.links, d.rides, today, state.view.form); tabbar(); bindNew(); return; }
  const yrs = years(d.rides); if (!state.year) state.year = yrs[0] || today.getFullYear();
  if (state.tab === 'fahrten') {
    root.innerHTML = ridesView(d.rides, d.bikes, state.fy, state.q, today); tabbar();
    root.querySelector('#set').onclick = openSettings; root.querySelector('#plus').onclick = openNew;
    const rl = root.querySelector('#rl'); const bind = () => rl.querySelectorAll('[data-ride]').forEach((b) => { b.onclick = () => openRide(b.dataset.ride); });
    const upd = () => { rl.innerHTML = ridesList(d.rides, d.bikes, state.fy, state.q); bind(); };
    root.querySelector('#fy').onchange = (e) => { state.fy = e.target.value; upd(); };
    let t; root.querySelector('#fq').oninput = (e) => { state.q = e.target.value; clearTimeout(t); t = setTimeout(upd, 150); };
    bind(); return;
  }
  root.innerHTML = state.tab === 'uebersicht' ? overviewView(d.rides, d.bikes, state.year, today, { goal: state.settings.goal, cmp: state.cmp })
    : bikesView(d.rides, d.bikes, d.wheelsets, d.links, d.changes, state.bike, lim, today);
  tabbar();
  root.querySelector('#set').onclick = openSettings; root.querySelector('#plus').onclick = openNew;
  root.querySelectorAll('[data-open-settings]').forEach((b) => { b.onclick = openSettings; });
  const cf = root.querySelector('#cmp-from'), ct = root.querySelector('#cmp-to');
  if (cf && ct) { const chg = () => { const y = window.scrollY; state.cmp = { from: +cf.value, to: +ct.value }; shell().then(() => window.scrollTo(0, y)); }; cf.onchange = chg; ct.onchange = chg; }
  const yr = root.querySelector('#yr'); if (yr) yr.onchange = () => { const y = window.scrollY; state.year = +yr.value; shell().then(() => window.scrollTo(0, y)); };
  root.querySelectorAll('[data-bike]').forEach((b) => { b.onclick = () => { const y = window.scrollY; state.bike = b.dataset.bike; shell().then(() => window.scrollTo(0, y)); }; });
  root.querySelectorAll('[data-ride]').forEach((b) => { b.onclick = () => openRide(b.dataset.ride); });
}

function openSettings() {
  document.getElementById('sheetwrap')?.remove();
  const wrap = document.createElement('div'); wrap.id = 'sheetwrap'; document.body.append(wrap);
  const draw = () => {
    const st = state.settings;
    wrap.innerHTML = `<div class="scrim" id="scrim"></div>` + settingsSheet(st.accent, st.limits, st.goal);
    const close = () => { wrap.remove(); shell(); };
    wrap.querySelector('#scrim').onclick = close; wrap.querySelector('#shdone').onclick = close;
    wrap.querySelectorAll('[data-acc]').forEach((b) => { b.onclick = () => { st.accent = applyTheme(b.dataset.acc); persistSettings(); draw(); }; });
    wrap.querySelector('[data-goal]')?.parentElement.querySelectorAll('[data-goal]').forEach((b) => { b.onclick = () => { st.goal = Math.max(500, st.goal + +b.dataset.goal); persistSettings(); draw(); }; });
    wrap.querySelectorAll('[data-lim]').forEach((b) => { b.onclick = () => {
      const [k, i, dlt] = b.dataset.lim.split(':'); const v = st.limits[k].slice(); v[+i] = Math.max(100, v[+i] + +dlt);
      if (v[0] >= v[1]) { if (+i === 0) v[0] = v[1] - 100; else v[1] = v[0] + 100; }
      st.limits = { ...st.limits, [k]: v }; persistSettings(); draw();
    }; });
  };
  draw();
}

function openNew() { state.scroll = window.scrollY; state.view = { type: 'new', form: {} }; shell(); window.scrollTo(0, 0); }

const num = (v) => { const x = parseFloat(String(v ?? '').trim().replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };
const dur = (v) => { const m = String(v ?? '').trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/); return m ? +m[1] * 3600 + +m[2] * 60 + +(m[3] || 0) : null; };
function bindNew() {
  const d = state.db; const q = (s) => root.querySelector(s); const val = (id) => q('#' + id).value;
  const pick = (grp) => q(`[data-group="${grp}"] .chipbtn.on`)?.dataset.v ?? null;
  const wsFor = (bid) => d.links.filter((l) => l.bike_id === bid).map((l) => d.wheelsets.find((w) => w.id === l.wheelset_id)).filter(Boolean);
  const lastRide = (bid) => d.rides.filter((r) => !bid || r.bike_id === bid).sort((a, b) => (b.datum + (b.uhrzeit || '')).localeCompare(a.datum + (a.uhrzeit || '')))[0];
  const exclusive = (el) => { el.parentElement.querySelectorAll('.chipbtn').forEach((x) => x.classList.toggle('on', x === el)); };
  const drawWs = (bid, sel) => {
    const list = wsFor(bid); const box = q('#wsbox');
    box.innerHTML = `<div class="chiprow" data-group="ws">${list.map((w) => `<button type="button" class="chipbtn${w.id === sel ? ' on' : ''}" data-v="${esc(w.id)}">${esc(w.name)}</button>`).join('') || '<span class="sub">Keine Laufräder zugeordnet</span>'}</div>`;
    box.querySelectorAll('.chipbtn').forEach((b) => { b.onclick = () => exclusive(b); });
  };
  q('#back').onclick = closeView;
  root.querySelectorAll('[data-group="art"] .chipbtn').forEach((b) => { b.onclick = () => exclusive(b); });
  root.querySelectorAll('[data-group="bike"] .chipbtn').forEach((b) => { b.onclick = () => { exclusive(b); drawWs(b.dataset.v, lastRide(b.dataset.v)?.wheelset_id); }; });
  root.querySelectorAll('[data-group="ws"] .chipbtn').forEach((b) => { b.onclick = () => exclusive(b); });
  if (pick('bike') && !pick('ws')) drawWs(pick('bike'), lastRide(pick('bike'))?.wheelset_id);
  root.querySelectorAll('.chg').forEach((b) => { b.onclick = () => b.classList.toggle('on'); });
  q('#more').onclick = () => { const box = q('#morebox'); box.hidden = !box.hidden; q('#more').setAttribute('aria-expanded', String(!box.hidden)); };
  q('#copylast').onclick = () => {
    const r = lastRide(); if (!r) return;
    const b = q(`[data-group="bike"] [data-v="${r.bike_id}"]`); if (b) { exclusive(b); drawWs(r.bike_id, r.wheelset_id); }
    const a = q(`[data-group="art"] [data-v="${r.art}"]`); if (a) exclusive(a);
    q('#f-place').value = r.ort || '';
  };
  q('#save').onclick = async () => {
    const err = q('#err'); err.innerHTML = '';
    const fail = (m) => { err.innerHTML = `<div class="err" role="alert">${esc(m)}</div>`; };
    const datum = val('f-date'); const km = num(val('f-km')); const bike = pick('bike'); const ws = pick('ws');
    if (!datum) return fail('Bitte ein Datum angeben.');
    if (!km) return fail('Bitte die Kilometer angeben (größer als 0).');
    if (!bike) return fail('Bitte ein Rad wählen.');
    const chg = [...root.querySelectorAll('.chg.on')].map((b) => b.dataset.chg);
    if (chg.some((p) => (p === 'ritzel' || p === 'reifen')) && !ws) return fail('Für Ritzel oder Reifen bitte einen Laufradsatz wählen.');
    const fz = dur(val('f-fz')); let avg = num(val('f-avg')); if (!avg && fz) avg = Math.round(km / (fz / 3600) * 10) / 10;
    const t = val('f-time').trim(); const time = /^\d{1,2}:\d{2}/.test(t) ? t.padStart(5, '0').slice(0, 5) + ':00' : null;
    const row = { datum, uhrzeit: time, name: val('f-name').trim() || null, ort: val('f-place').trim() || null, art: pick('art') || 'Training', bike_id: Number(bike), wheelset_id: ws ? Number(ws) : null, km,
      total_time_s: dur(val('f-gz')), ride_time_s: fz, avg_speed: avg, max_speed: num(val('f-mx')), avg_power: num(val('f-pw')), norm_power: num(val('f-np')), elevation_m: num(val('f-hm')),
      avg_hr: num(val('f-hra')), max_hr: num(val('f-hrm')), avg_cadence: num(val('f-cada')), max_cadence: num(val('f-cadm')), avg_temp: num(val('f-tmp')), beschreibung: val('f-desc').trim() || null };
    const btn = q('#save'); btn.disabled = true; btn.textContent = 'Wird gespeichert …';
    const { data: ins, error } = await sb.schema('rad').from('rides').insert(row).select().single();
    if (error) { btn.disabled = false; btn.textContent = 'Fahrt speichern'; return fail('Speichern fehlgeschlagen: ' + error.message); }
    let chgTxt = '';
    if (chg.length) {
      const rows = chg.map((p) => ({ part: p, datum, note: 'bei Fahrt erfasst', ...((p === 'ritzel' || p === 'reifen') ? { wheelset_id: Number(ws) } : { bike_id: Number(bike) }) }));
      const { data: cins, error: e2 } = await sb.schema('rad').from('component_changes').insert(rows).select();
      if (e2) chgTxt = 'Die Fahrt ist gespeichert, die Teilewechsel nicht: ' + e2.message;
      else { cins.forEach((c) => d.changes.push({ ...c, bike_id: S(c.bike_id), wheelset_id: S(c.wheelset_id) })); chgTxt = 'Gewechselt: ' + chg.map((p) => ({ kette: 'Kette', ritzel: 'Ritzel', reifen: 'Reifen', bremsscheibe: 'Bremsscheiben' }[p])).join(', '); }
    }
    ins.id = S(ins.id); ins.bike_id = S(ins.bike_id); ins.wheelset_id = S(ins.wheelset_id); d.rides.push(ins); state.year = +datum.slice(0, 4);
    const bl = d.bikes.find((b) => b.id === ins.bike_id)?.label || '';
    root.innerHTML = `<div class="top"><button class="rb" id="back" aria-label="Zurück">‹</button><div class="grow"><div class="sub">Neue Aktivität</div><h1 class="small">Gespeichert</h1></div></div>
      <div class="card hero" role="status"><div class="lab">${esc(datum.split('-').reverse().join('.'))} · ${de(km, 1)} km · ${esc(bl)}</div>${chgTxt ? `<div class="sub">${esc(chgTxt)}</div>` : ''}
      <div class="btnrow"><button id="sv-view">Fahrt ansehen</button><button class="ghost" id="sv-more">Weitere erfassen</button></div></div>`;
    root.querySelector('#back').onclick = () => { state.view = null; state.tab = 'uebersicht'; shell(); window.scrollTo(0, 0); };
    root.querySelector('#sv-view').onclick = () => openRide(ins.id);
    root.querySelector('#sv-more').onclick = () => { state.view = { type: 'new', form: {} }; shell(); };
  };
}

async function boot() {
  applyTheme(savedAccent() || ACCENTS[0][1]);
  state.tab = 'uebersicht'; state.view = null; shell();
}
const { data } = await sb.auth.getSession();
if (data.session) boot(); else loginView();

