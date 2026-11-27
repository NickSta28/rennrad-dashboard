// Import der Rohdatei (Blatt "Datenbank_fix") nach Schema rad. Reine Funktionen, im Browser und in Node testbar.
export const BIKES = [
  ['TCR SL', 'TCR SL', 'Giant TCR Advanced SL', 'aktiv'],
  ['Orbea', 'Orbea', 'Orbea Orca', 'aktiv'],
  ['TCR Pro', 'TCR Pro', 'Giant TCR Advanced Pro', 'aktiv'],
  ['Leihrad', 'Leihrad', 'Leihrad', 'aktiv'],
  ['Focus Izalco 2018', 'Izalco', 'Focus Izalco Max 2018', 'inaktiv'],
  ['Giant Propel', 'Propel', 'Giant Propel Advanced SL', 'inaktiv'],
  ['Focus Cayo 2017', 'Cayo 2017', 'Focus Cayo 2017', 'inaktiv'],
  ['Focus Cayo 2016', 'Cayo 2016', 'Focus Cayo 2016', 'inaktiv'],
  ['Focus Cayo Donna 2014', 'Cayo Donna', 'Focus Cayo Donna 2014', 'inaktiv'],
  ['Focus Cayo Evo 2015', 'Cayo Evo', 'Focus Cayo Evo 2015', 'inaktiv'],
  ['GFPro', 'GF Pro', 'GF Pro', 'inaktiv'],
];
export const WHEELS = { 'Newmen Allround': 'aktiv', 'Newmen Climbing': 'aktiv', 'Leeze CC 38': 'aktiv', 'Cadex 50': 'inaktiv', 'Fulcrum Alu': 'inaktiv', 'Zipp 404': 'inaktiv', 'Vision Metron': 'inaktiv' };
// Welcher Laufradsatz passt an welches Rad (zusätzlich zu den in den Fahrten beobachteten)
export const FITS = {
  'TCR SL': ['Newmen Allround', 'Newmen Climbing', 'Leeze CC 38'], 'TCR Pro': ['Newmen Allround', 'Newmen Climbing', 'Leeze CC 38'],
  'Giant Propel': ['Newmen Allround', 'Newmen Climbing', 'Cadex 50'], 'Focus Cayo 2017': ['Zipp 404'], 'Focus Izalco 2018': ['Vision Metron'],
};
const COL = ['Datum', 'Uhrzeit', 'Aktivitätsname', 'Ort', 'Art', 'Activity ID', 'Rad', 'Laufräder', 'km', 'Total Time', 'Fahrtzeit', 'Avg Speed', 'Max Speed', 'Avg Power', 'gewichtete Leistung', 'Höhenmeter', 'Durchschn. Puls', 'Max. Puls', 'Durchschn. Trittfrequenz', 'Max. Trittfrequenz', 'Durchschn. Temperatur', 'Beschreibung', 'Kette neu?', 'Ritzel neu?', 'Reifen neu?', 'Bremsscheiben neu?'];
const pad = (n) => String(n).padStart(2, '0');
// Excel-Seriennummer oder Date -> 'YYYY-MM-DD'
export function toDate(v) {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return toDate(d); }
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
}
// Uhrzeit-Zelle -> 'HH:MM:SS' (Text, Bruchteil eines Tages oder Date)
export function toTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const s = Math.round((v % 1) * 86400); return `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; }
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
  const m = String(v).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? `${pad(+m[1])}:${m[2]}:${m[3] || '00'}` : null;
}
// Dauer-Zelle -> Sekunden
export function toSecs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 86400);
  const m = String(v).match(/^(\d+):(\d{2})(?::(\d{2}))?/); return m ? +m[1] * 3600 + +m[2] * 60 + +(m[3] || 0) : null;
}
// Messwert: leer, 0, '#N/A' oder Text -> null
const val = (v, int) => { if (typeof v !== 'number' || !(v > 0)) return null; return int ? Math.round(v) : Math.round(v * 100) / 100; };
export function parseRows(rows) {
  const head = rows[0].map((h) => String(h || '').trim());
  const miss = COL.filter((c) => !head.includes(c)); if (miss.length) throw new Error('Spalten fehlen: ' + miss.join(', '));
  const ix = Object.fromEntries(COL.map((c) => [c, head.indexOf(c)]));
  const warn = []; const rides = []; const changes = [];
  const bikeKeys = new Set(BIKES.map((b) => b[0]));
  rows.slice(1).forEach((r, n) => {
    const g = (c) => r[ix[c]];
    const datum = toDate(g('Datum')); if (!datum) return;
    const rad = String(g('Rad') || '').trim();
    if (!bikeKeys.has(rad)) { warn.push(`Zeile ${n + 2}: unbekanntes Rad "${rad}"`); return; }
    const art = ['Training', 'Rennen', 'virtuell'].includes(g('Art')) ? g('Art') : 'Training';
    const lr = g('Laufräder') ? String(g('Laufräder')).trim() : null;
    const aid = Number(g('Activity ID')); const km = val(g('km'));
    rides.push({
      datum, uhrzeit: toTime(g('Uhrzeit')), name: g('Aktivitätsname') ? String(g('Aktivitätsname')) : null, ort: g('Ort') ? String(g('Ort')) : null, art,
      strava_activity_id: Number.isFinite(aid) && aid > 0 ? aid : null, _rad: rad, _lr: lr, km,
      total_time_s: toSecs(g('Total Time')), ride_time_s: toSecs(g('Fahrtzeit')), avg_speed: val(g('Avg Speed')), max_speed: val(g('Max Speed')),
      avg_power: val(g('Avg Power'), true), norm_power: val(g('gewichtete Leistung'), true), elevation_m: val(g('Höhenmeter'), true),
      avg_hr: val(g('Durchschn. Puls'), true), max_hr: val(g('Max. Puls'), true), avg_cadence: val(g('Durchschn. Trittfrequenz'), true), max_cadence: val(g('Max. Trittfrequenz'), true),
      avg_temp: typeof g('Durchschn. Temperatur') === 'number' && g('Durchschn. Temperatur') !== 0 ? Math.round(g('Durchschn. Temperatur') * 10) / 10 : null,
      beschreibung: g('Beschreibung') ? String(g('Beschreibung')) : null,
    });
    const ja = (c) => g(c) === 'Ja';
    if (ja('Kette neu?')) changes.push({ part: 'kette', datum, _rad: rad });
    if (ja('Bremsscheiben neu?')) changes.push({ part: 'bremsscheibe', datum, _rad: rad });
    for (const [c, part] of [['Ritzel neu?', 'ritzel'], ['Reifen neu?', 'reifen']]) if (ja(c)) { if (lr) changes.push({ part, datum, _lr: lr }); else warn.push(`${datum}: ${part} gewechselt, aber kein Laufradsatz angegeben`); }
  });
  return { rides, changes, warn };
}
export const summary = (p) => ({ fahrten: p.rides.length, km: Math.round(p.rides.reduce((s, r) => s + (r.km || 0), 0) * 10) / 10, mitPuls: p.rides.filter((r) => r.avg_hr).length, wechsel: p.changes.length, hinweise: p.warn.length });

// Schreibt in Schema rad. client = supabase-js-Client mit Login.
export async function runImport(client, parsed, { replace = false, onProgress = () => {} } = {}) {
  const db = client.schema('rad');
  const must = (res, what) => { if (res.error) throw new Error(what + ': ' + res.error.message); return res.data; };
  const cnt = await db.from('rides').select('id', { count: 'exact', head: true }); must(cnt, 'Prüfung');
  if (cnt.count > 0 && !replace) throw new Error(`Es gibt schon ${cnt.count} Fahrten. Zum Ersetzen das Häkchen setzen.`);
  if (replace) { onProgress('Vorhandene Daten werden gelöscht …');
    for (const t of ['component_changes', 'rides', 'bike_wheelsets', 'wheelsets', 'bikes']) must(await db.from(t).delete().neq('user_id', '00000000-0000-0000-0000-000000000000'), 'Löschen ' + t); }
  onProgress('Räder und Laufräder …');
  const bikes = must(await db.from('bikes').insert(BIKES.map((b, i) => ({ key: b[0], label: b[1], full_name: b[2], status: b[3], sort: i }))).select('id,key'), 'Räder');
  const bid = Object.fromEntries(bikes.map((b) => [b.key, b.id]));
  const wn = [...new Set([...Object.keys(WHEELS), ...parsed.rides.map((r) => r._lr).filter(Boolean)])];
  const wheels = must(await db.from('wheelsets').insert(wn.map((n) => ({ name: n, status: WHEELS[n] || 'inaktiv' }))).select('id,name'), 'Laufräder');
  const wid = Object.fromEntries(wheels.map((w) => [w.name, w.id]));
  const fit = new Set(); Object.entries(FITS).forEach(([b, ws]) => ws.forEach((w) => fit.add(b + '|' + w))); parsed.rides.forEach((r) => r._lr && fit.add(r._rad + '|' + r._lr));
  must(await db.from('bike_wheelsets').insert([...fit].map((s) => { const [b, w] = s.split('|'); return { bike_id: bid[b], wheelset_id: wid[w] }; })), 'Zuordnung');
  const rows = parsed.rides.map(({ _rad, _lr, ...r }) => ({ ...r, bike_id: bid[_rad], wheelset_id: _lr ? wid[_lr] : null }));
  for (let i = 0; i < rows.length; i += 200) { must(await db.from('rides').insert(rows.slice(i, i + 200)), 'Fahrten ' + i); onProgress(`Fahrten ${Math.min(i + 200, rows.length)} / ${rows.length}`); }
  onProgress('Wechsel-Protokoll …');
  must(await db.from('component_changes').insert(parsed.changes.map((c) => ({ part: c.part, datum: c.datum, bike_id: c._rad ? bid[c._rad] : null, wheelset_id: c._lr ? wid[c._lr] : null, note: 'aus Rohdatei' }))), 'Wechsel');
  return { bikes: bikes.length, wheelsets: wheels.length, rides: rows.length, changes: parsed.changes.length };
}
