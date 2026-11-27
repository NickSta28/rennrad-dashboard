// HTML-Erzeugung (reine Funktionen, Node-testbar)
import { MON, MONL, CLASSES, MONTH_END, yearOverview, pulseCard, bikeWear, bikeStats, years, rangeAvg, DEFAULT_LIMITS } from './compute.js?v=5';
import { ACCENTS } from './theme.js?v=5';

export const de = (n, d = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const dmy = (d) => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '–');
const dm = (d) => d.slice(8, 10) + '.' + d.slice(5, 7) + '.';
export const hm = (s) => (s ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–');
const LV = [['#4C7A4A', '#E3F1E1', 'OK'], ['#C98A00', '#FBEFC9', 'Bald fällig'], ['#C0392B', '#F8DAD6', 'Wechsel fällig']];
export const PARTS = { kette: ['Kette', 'img/kette.png'], ritzel: ['Ritzel', 'img/ritzel.png'], reifen: ['Reifen', 'img/reifen.png'], bremsscheibe: ['Bremsscheiben', 'img/bremse.png'] };
const same = (a, b) => String(a) === String(b);
const ICON = { gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>' };
const svg = (k, w = 20, sw = 1.8) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

export function header(title, today, withYear = '') {
  return `<div class="top"><div><div class="sub">Stand ${dmy(today.toISOString().slice(0, 10))}</div><h1>${title}</h1></div>
  <div class="tools"><button class="rb" id="set" aria-label="Einstellungen">${svg('gear')}</button><button class="rb fill" id="plus" aria-label="Fahrt erfassen">${svg('plus', 20, 2.4)}</button>${withYear}</div></div>`;
}

function bars(vals, labels, { h = 90, prev = null, fmt = (v) => de(v) } = {}) {
  const max = Math.max(1, ...vals, ...(prev || [0])); const w = 300; const bw = w / vals.length;
  return `<svg viewBox="0 0 ${w} ${h + 18}" class="chart" role="img" aria-label="Balkendiagramm">${vals.map((v, i) => {
    const bh = v / max * h; const ph = prev ? prev[i] / max * h : 0;
    return `${prev ? `<rect x="${i * bw + 1}" y="${h - ph}" width="${bw / 2 - 1}" height="${ph}" fill="var(--prior)" rx="2"/>` : ''}<rect x="${i * bw + (prev ? bw / 2 : 2)}" y="${h - bh}" width="${prev ? bw / 2 - 1 : bw - 4}" height="${bh}" fill="var(--accent)" rx="2"><title>${labels[i]}: ${fmt(v)}</title></rect><text x="${i * bw + bw / 2}" y="${h + 13}" text-anchor="middle" class="ax">${labels[i]}</text>`;
  }).join('')}</svg>`;
}

function curve(o, avg) {
  const w = 300, h = 120; const ends = o.cumYears.flatMap((y) => (y.pts.length ? [y.pts.at(-1)[1]] : [0]));
  const maxY = Math.max(o.goal, ...ends, ...(avg ? avg.vals.filter((v) => v != null) : [0])) * 1.05;
  const X = (d) => d / o.total * w; const Y = (v) => h - v / maxY * h;
  const path = (pts) => 'M0,' + h + ' ' + pts.map(([d, v]) => `L${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const cols = ['var(--accent)', 'var(--prior)', '#B8BDC7']; const wd = [2.8, 2, 2];
  const lines = [...o.cumYears].reverse().map((y) => { const i = o.cumYears.indexOf(y); return y.pts.length ? `<path d="${path(y.pts)}" fill="none" stroke="${cols[i]}" stroke-width="${wd[i]}" stroke-linejoin="round"/>` : ''; }).join('');
  const ap = avg ? avg.vals.map((v, i) => (v == null ? null : [MONTH_END[i], v])).filter(Boolean) : [];
  const avgLine = ap.length ? `<polyline points="0,${h} ${ap.map(([d, v]) => `${X(d * o.total / 365).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>${ap.map(([d, v]) => `<circle cx="${X(d * o.total / 365).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="var(--ink)"><title>Ø ${de(v)} km</title></circle>`).join('')}` : '';
  const ticks = MONTH_END.map((d, i) => `<text x="${X(((i ? MONTH_END[i - 1] : 0) + d) / 2 * o.total / 365).toFixed(1)}" y="${h + 14}" text-anchor="middle" class="ax">${MON[i][0]}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h + 18}" class="chart" role="img" aria-label="Kumulierte Kilometer im Jahresverlauf">
    <line x1="0" y1="${h}" x2="${w}" y2="${Y(o.goal)}" stroke="var(--mute)" stroke-width="1" stroke-dasharray="4 4"/>${lines}${avgLine}${ticks}</svg>
    <div class="legend">${o.cumYears.map((y, i) => `<span><i style="background:${cols[i]}"></i>${y.year}</span>`).join('')}${avg ? `<span><i class="dots"></i>Ø ${avg.years > 1 ? 'Zeitraum' : 'Jahr'}</span>` : ''}<span><i class="dash"></i>Ziel ${de(o.goal)} km</span></div>`;
}

const rideRow = (r, bikes, sub) => `<button class="ride" data-ride="${r.id}"><div><b>${esc(r.name || 'Fahrt')}</b><span>${sub}</span></div><div class="rk"><b>${de(r.km || 0, 1)} km</b>${svg('next', 16, 2)}</div></button>`;

export function overviewView(rides, bikes, year, today, settings = {}) {
  const yrs = years(rides); const head = (y = '') => header('Übersicht', today, y);
  const yearSel = `<select id="yr" aria-label="Jahr">${yrs.map((y) => `<option${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select>`;
  if (!yrs.length) return head() + '<div class="card">Noch keine Fahrten. Erfasse die erste mit „+“ oder importiere unter „Daten“.</div>';
  const o = yearOverview(rides, bikes, year, today, settings.goal || 4500);
  const chip = o.cur ? (o.ahead >= 0 ? ['on track', 'ok'] : ['im Rückstand', 'warn']) : (o.km >= o.goal ? ['Ziel erreicht', 'ok'] : ['Ziel verfehlt', 'warn']);
  const hs = o.cur ? [['Vorsprung', (o.ahead >= 0 ? '+' : '−') + de(Math.abs(o.ahead)) + ' %'], ['Noch offen', de(o.open) + ' km'], ['Nötig pro Woche', de(o.perWeek) + ' km']]
    : [['Ziel-Quote', de(o.pct) + ' %'], ['Differenz', (o.km >= o.goal ? '+' : '−') + de(Math.abs(o.km - o.goal)) + ' km'], ['Fahrten', de(o.n)]];
  const pc = pulseCard(rides);
  const first = yrs[yrs.length - 1]; const cmp = settings.cmp || { from: first, to: Math.max(first, year - 1) };
  const avg = settings.wide !== false ? rangeAvg(rides, cmp.from, cmp.to, today) : null;
  const opts = (sel) => yrs.slice().reverse().map((y) => `<option${y === sel ? ' selected' : ''}>${y}</option>`).join('');
  const cmpBar = settings.wide !== false ? `<div class="cmpbar"><span>Mittelwert über Zeitraum</span><label class="sr" for="cmp-from">Von</label><select id="cmp-from">${opts(cmp.from)}</select><span>bis</span><label class="sr" for="cmp-to">Bis</label><select id="cmp-to">${opts(cmp.to)}</select></div>` : '';
  return head(yearSel) + `
  <div class="card hero goal"><div class="row"><span class="lab">Jahresziel ${year}</span><span class="chip ${chip[1]}">${chip[0]}</span></div>
    <div class="herobig"><b>${de(o.km)}</b><span>km</span><em>von ${de(o.goal)} km</em></div>
    <div class="prog" role="progressbar" aria-valuenow="${Math.round(o.pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, o.pct)}%"></i>${o.cur ? `<b style="left:${o.timePct}%"></b>` : ''}</div>
    <div class="caps"><span>${Math.round(o.pct)} % der Kilometer</span><span>${o.cur ? `Zeit: ${Math.round(o.timePct)} %` : 'Jahr abgeschlossen'}</span></div>
    <div class="trio">${hs.map((h) => `<div><span>${h[0]}</span><b>${h[1]}</b></div>`).join('')}</div></div>
  <div class="kpis">
    <div class="kpi"><span>Fahrten</span><b>${de(o.n)}</b><em>${o.over100} über 100 km</em></div>
    <div class="kpi"><span>Kilometer</span><b>${de(o.km)}</b><em>Ø ${de(o.n ? o.km / o.n : 0, 1)} km je Fahrt</em></div>
    <div class="kpi"><span>Höhenmeter</span><b>${de(o.hm)}</b><em>Ø ${de(o.n ? o.hm / o.n : 0)} Hm je Fahrt</em></div>
    <div class="kpi"><span>Höchster Ø-Speed</span><b>${o.speed ? de(o.speed.avg_speed, 1) : '–'}<small> km/h</small></b><em>${o.speed ? 'Fahrt im ' + MONL[+o.speed.datum.slice(5, 7) - 1] : ''}</em></div></div>
  ${pc ? pulseHtml(pc) : ''}
  <div class="card"><h2>Kilometer im Jahresverlauf</h2>${curve(o, avg)}${cmpBar}</div>
  <div class="card"><h2>Kilometer je Monat</h2>${bars(o.mon, MON, { prev: o.prev })}
    <div class="legend"><span><i style="background:var(--accent)"></i>${year}</span><span><i style="background:var(--prior)"></i>${year - 1}</span></div>
    <div class="sub">Bester Monat: ${MONL[o.best.m]} mit ${de(o.best.km)} km</div></div>
  <div class="card"><h2>Fahrten je Wochentag</h2>${bars(o.wd, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], { h: 70 })}</div>
  <div class="card"><h2>Anteil je Rad</h2>${o.shares.map((s) => `<div class="share"><div class="row"><span>${esc(s.bike?.label || '?')}</span><b>${de(s.km)} km · ${Math.round(s.pct)} %</b></div><div class="bar"><i style="width:${s.pct}%"></i></div></div>`).join('')}</div>
  <div class="card"><h2>Letzte Fahrten</h2>${o.last.map((r) => rideRow(r, bikes, `${dm(r.datum)} · ${esc(bikes.find((b) => same(b.id, r.bike_id))?.label || '')} · ${de(r.elevation_m || 0)} Hm${r.avg_speed ? ' · ' + de(r.avg_speed, 1) + ' km/h' : ''}`)).join('')}</div>
  <div class="card"><h2>Vergleich bis zum ${o.cur ? dm(today.toISOString().slice(0, 10)) : '31.12.'}</h2>${o.others.map((x) => `<div class="row cmp"><span>${x.year}: ${de(x.km)} km</span><b class="${x.delta >= 0 ? 'good' : 'bad'}">${x.delta >= 0 ? '+' : '−'}${de(Math.abs(x.delta))} km</b></div>`).join('')}
    <div class="row cmp"><span>Ziel-Pace: ${de(o.pace)} km</span><b class="${o.km - o.pace >= 0 ? 'good' : 'bad'}">${o.km - o.pace >= 0 ? '+' : '−'}${de(Math.abs(o.km - o.pace))} km</b></div></div>`;
}

function pulseHtml(pc) {
  const lo = 100, hi = 180, h = 80, w = 300; const bw = w / pc.recent.length;
  const Y = (v) => h - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * h;
  return `<div class="card"><h2>Puls</h2>
    <div class="row"><div class="big">${de(pc.last.avg_hr)}<small> bpm Ø</small></div><span class="chip ${pc.diff <= 0 ? 'ok' : 'warn'}">${pc.diff >= 0 ? '+' : '−'}${de(Math.abs(pc.diff), 0)} gegenüber Ø</span></div>
    <div class="sub">Letzte Fahrt mit Puls (${dmy(pc.last.datum)}, ${esc(pc.art)}) · Ø seit ${pc.since} (${esc(pc.art)}): ${de(pc.avg)} bpm, ${de(pc.n)} Fahrten</div>
    <svg viewBox="0 0 ${w} ${h + 4}" class="chart" role="img" aria-label="Durchschnittspuls der letzten 20 Fahrten">${pc.recent.map((r, i) => `<rect x="${i * bw + 2}" y="${Y(r.avg_hr)}" width="${bw - 4}" height="${h - Y(r.avg_hr)}" fill="${i === pc.recent.length - 1 ? 'var(--accent)' : 'var(--lvl1)'}" rx="2"><title>${dm(r.datum)}: ${r.avg_hr} bpm</title></rect>`).join('')}
    <line x1="0" x2="${w}" y1="${Y(pc.avg)}" y2="${Y(pc.avg)}" stroke="var(--mute)" stroke-dasharray="4 4"/></svg>
    <div class="sub">Letzte 20 Fahrten mit Puls · Achse ab 100 bpm</div></div>`;
}

export function bikesView(rides, bikes, wheelsets, links, changes, sel, limits, today) {
  const used = bikes.filter((b) => rides.some((r) => same(r.bike_id, b.id)));
  const act = used.sort((a, b) => (a.status === b.status ? a.sort - b.sort : a.status === 'aktiv' ? -1 : 1));
  const bike = act.find((b) => same(b.id, sel)) || act[0];
  if (!bike) return header('Räder', today) + '<div class="card">Keine Räder.</div>';
  const st = bikeStats(rides, bike);
  const wsOf = links.filter((l) => same(l.bike_id, bike.id)).map((l) => wheelsets.find((w) => same(w.id, l.wheelset_id))).filter(Boolean);
  const wsOnBike = (w) => rides.filter((r) => same(r.bike_id, bike.id) && same(r.wheelset_id, w.id));
  const wsRows = wsOf.map((w) => { const rs = wsOnBike(w); return { w, km: rs.reduce((s, r) => s + Number(r.km || 0), 0), n: rs.length }; }).sort((a, b) => b.km - a.km);
  const wsMax = Math.max(1, ...wsRows.map((x) => x.km));
  const wearRows = bikeWear(bike, rides, changes, wheelsets, limits);
  const rec = (r, label, val, unit, ico) => r ? `<button class="rec" data-ride="${r.id}"><span class="rico"><img src="img/${ico}.png" alt=""></span><div class="rv">${val}<small> ${unit}</small></div><div class="rt"><span>${label}</span><em>${dmy(r.datum)} · ${esc(r.name || '')}</em></div>${svg('next', 16, 2)}</button>` : '';
  return header('Räder', today) + `
  <div class="chips" role="tablist" aria-label="Rad wählen">${act.map((b) => `<button class="chipbtn${same(b.id, bike.id) ? ' on' : ''}${b.status !== 'aktiv' ? ' off' : ''}" data-bike="${b.id}" role="tab" aria-selected="${same(b.id, bike.id)}">${esc(b.label)}</button>`).join('')}</div>
  <div class="card tintcard">${bike.photo_path ? `<img class="bikeimg" src="${esc(bike.photo_path)}" alt="${esc(bike.full_name)}" loading="lazy">` : '<div class="ph" aria-hidden="true">🚲</div>'}
    <div class="row"><h2 class="bn">${esc(bike.full_name || bike.label)}</h2><span class="chip ${bike.status === 'aktiv' ? 'ok' : 'mute'}">${esc(bike.status)}</span></div>
    <div class="herobig"><b>${de(st.km)}</b><span>km</span><em>${de(st.n)} Fahrten</em></div>
    <div class="trio"><div><span>Erste Fahrt</span><b>${dmy(st.first)}</b></div><div><span>Letzte Fahrt</span><b>${dmy(st.last)}</b></div><div><span>Pause</span><b>${bike.status === 'aktiv' ? Math.max(0, Math.round((today - new Date(st.last + 'T00:00:00Z')) / 864e5)) + ' Tage' : '–'}</b></div></div></div>
  <div class="card"><div class="row"><h2>Verschleiß</h2><button class="link" data-open-settings>Grenzen ändern</button></div>${wearRows.length ? wearRows.map((w) => { const l = LV[w.lvl]; const P = PARTS[w.part];
    return `<div class="wear"><img src="${P[1]}" alt="" width="48" height="48"><div class="wb"><div class="row"><span class="wn">${P[0]}${w.owner ? ` <em>${esc(w.owner)}</em>` : ''}</span><span class="chip" style="background:${l[1]};color:${l[0]}">${l[2]}</span></div>
      <div class="bar thin"><i style="width:${w.pct}%;background:${l[0]}"></i><b style="left:${w.yellow / w.red * 100}%"></b></div>
      <div class="row sub"><span>${de(w.km)} km seit ${dmy(w.since)}${w.fromFirstRide ? ' (erste Fahrt)' : ''}</span><span>gelb ${de(w.yellow)} · rot ${de(w.red)}</span></div></div></div>`; }).join('') : '<div class="sub">Keine Daten.</div>'}</div>
  <div class="card"><h2>Rekorde</h2><div class="recs">${rec(st.longest, 'Längste Fahrt', de(st.longest?.km || 0, 1), 'km', 'rek-km')}${rec(st.fastest, 'Schnellste Fahrt', de(st.fastest?.avg_speed || 0, 1), 'km/h', 'rek-kmh')}${rec(st.climb, 'Meiste Höhenmeter', de(st.climb?.elevation_m || 0), 'hm', 'rek-hm')}</div></div>
  ${wsRows.length ? `<div class="card"><h2>Laufräder</h2>${wsRows.map((x) => `<div class="wsrow"><div class="row"><b>${esc(x.w.name)}</b><span class="chip ${x.w.status === 'aktiv' ? 'ok' : 'mute'}">${esc(x.w.status)}</span></div><div class="sub">${de(x.km)} km · ${de(x.n)} Fahrten auf diesem Rad</div><div class="bar thin"><i style="width:${x.km / wsMax * 100}%;${x.w.status === 'aktiv' ? '' : 'background:var(--prior)'}"></i></div></div>`).join('')}</div>` : ''}
  <div class="card"><h2>Fahrten je Jahr und Länge</h2><div class="tbl"><table><thead><tr><th>Jahr</th><th>Fahrt.</th><th>km</th>${CLASSES.map((c) => `<th>${c[2]}</th>`).join('')}</tr></thead>
    <tbody>${st.perYear.map((y) => `<tr><td>${y.year}</td><td>${y.n}</td><td>${de(y.km)}</td>${y.cls.map((c) => `<td>${c || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

export function ridesList(rides, bikes, year, q) {
  const s = (q || '').trim().toLowerCase();
  let list = rides.filter((r) => (year === 'alle' || String(r.datum.slice(0, 4)) === String(year)) && (!s || [r.name, r.ort, bikes.find((b) => same(b.id, r.bike_id))?.label, r.datum, dmy(r.datum)].some((x) => String(x || '').toLowerCase().includes(s))));
  list.sort((a, b) => (b.datum + (b.uhrzeit || '')).localeCompare(a.datum + (a.uhrzeit || '')));
  const total = list.length; const km = list.reduce((t, r) => t + Number(r.km || 0), 0); list = list.slice(0, 250);
  let last = ''; const rows = list.map((r) => { const m = r.datum.slice(0, 7); const hd = m !== last ? `<div class="mh">${MONL[+m.slice(5) - 1]} ${m.slice(0, 4)}</div>` : ''; last = m;
    return hd + rideRow(r, bikes, `${dm(r.datum)} · ${esc(bikes.find((b) => same(b.id, r.bike_id))?.label || '')}${r.elevation_m ? ' · ' + de(r.elevation_m) + ' Hm' : ''}`); }).join('');
  return `<div class="sub" role="status">${de(total)} Fahrten · ${de(km)} km${total > 250 ? ' · es werden die neuesten 250 gezeigt, bitte Filter oder Suche eingrenzen' : ''}</div>${rows || '<div class="card">Keine Fahrten gefunden.</div>'}`;
}

export function ridesView(rides, bikes, year, q, today) {
  const yrs = years(rides);
  return header('Fahrten', today) + `<div class="filter"><select id="fy" aria-label="Jahr"><option value="alle"${year === 'alle' ? ' selected' : ''}>Alle Jahre</option>${yrs.map((y) => `<option${String(y) === String(year) ? ' selected' : ''}>${y}</option>`).join('')}</select>
    <input id="fq" type="search" inputmode="search" placeholder="Suchen: Name, Ort, Rad, Datum" value="${esc(q || '')}" autocomplete="off" aria-label="Fahrten suchen"></div><div id="rl" class="card list2">${ridesList(rides, bikes, year, q)}</div>`;
}

export function activityView(r, bikes, wheelsets) {
  const bike = bikes.find((b) => same(b.id, r.bike_id)); const ws = wheelsets.find((w) => same(w.id, r.wheelset_id));
  const tile = (l, v) => `<div class="tile"><span>${l}</span><b>${v}</b></div>`;
  const row = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const meas = [r.avg_hr && row('Puls (Ø / Max)', `${de(r.avg_hr)}${r.max_hr ? ' / ' + de(r.max_hr) : ''} bpm`), r.avg_cadence && row('Trittfrequenz (Ø / Max)', `${de(r.avg_cadence)}${r.max_cadence ? ' / ' + de(r.max_cadence) : ''} rpm`),
    r.avg_temp && row('Temperatur', `${de(r.avg_temp, 1)} °C`), r.norm_power && row('Gewichtete Leistung', `${de(r.norm_power)} W`)].filter(Boolean);
  const art = { Training: 'ok', Rennen: 'warn', virtuell: 'mute' }[r.art] || 'mute';
  return `<div class="top"><button class="rb" id="back" aria-label="Zurück">${svg('back', 18, 2.2)}</button><div class="grow"><div class="sub">Aktivität</div><h1 class="small">${dmy(r.datum)}</h1></div></div>
  <div class="card hero"><div class="row"><span class="chip ${art}">${esc(r.art)}</span><span class="sub">${r.uhrzeit ? r.uhrzeit.slice(0, 5) + ' Uhr' : ''}${r.ort ? ' · ' + esc(r.ort) : ''}</span></div>
    <h2 class="an">${esc(r.name || 'Fahrt')}</h2><div class="herobig"><b>${de(r.km || 0, 1)}</b><span>km</span></div></div>
  <div class="tiles">${tile('Fahrtzeit', hm(r.ride_time_s))}${tile('Ø Tempo', r.avg_speed ? de(r.avg_speed, 1) + ' km/h' : '–')}${tile('Max. Tempo', r.max_speed ? de(r.max_speed, 1) + ' km/h' : '–')}${tile('Ø Leistung', r.avg_power ? de(r.avg_power) + ' W' : '–')}${tile('Höhenmeter', r.elevation_m ? de(r.elevation_m) + ' hm' : '–')}${tile('Gesamtzeit', hm(r.total_time_s))}</div>
  <div class="card list">${row('Rad', esc(bike?.label || '–'))}${row('Laufräder', esc(ws?.name || '–'))}</div>
  ${meas.length ? `<div class="card list">${meas.join('')}</div>` : ''}
  ${r.beschreibung ? `<div class="card"><div class="sub">Beschreibung</div><p class="desc">${esc(r.beschreibung)}</p></div>` : ''}
  ${r.strava_activity_id ? `<div class="card list">${row('Strava-ID', r.strava_activity_id)}</div>` : ''}
  ${r.strava_activity_id ? `<a class="linkbtn" href="https://www.strava.com/activities/${r.strava_activity_id}" target="_blank" rel="noopener">In Strava öffnen</a>` : ''}`;
}

export function settingsSheet(accent, limits, goal) {
  const lim = limits || DEFAULT_LIMITS;
  const stp = (dot, lab, key, i) => `<div class="stp"><div class="sub"><i style="background:${dot}"></i>${lab}</div><div class="stpr"><button data-lim="${key}:${i}:-100" aria-label="weniger">−</button><span>${de(lim[key][i])} km</span><button data-lim="${key}:${i}:100" aria-label="mehr">+</button></div></div>`;
  const rows = [['kette', 'Kette', 'img/kette.png'], ['ritzel', 'Ritzel', 'img/ritzel.png'], ['reifen', 'Reifen', 'img/reifen.png'], ['bremse', 'Bremsscheiben', 'img/bremse.png']];
  return `<div class="sheet" role="dialog" aria-label="Einstellungen"><div class="row"><h2 class="sh">Einstellungen</h2><button class="link big" id="shdone">Fertig</button></div>
  <h3>Farbschema</h3><div class="sub">Gilt für alle Ansichten.</div>
  <div class="sw">${ACCENTS.map(([n, c]) => `<button data-acc="${c}" aria-label="${n}" aria-pressed="${c === accent}"><span style="background:${c};${c === accent ? 'outline:3px solid ' + c : ''}"></span>${n}</button>`).join('')}</div>
  <h3>Jahresziel</h3><div class="stpr one"><button data-goal="-100" aria-label="weniger">−</button><span>${de(goal)} km</span><button data-goal="100" aria-label="mehr">+</button></div>
  <h3>Verschleiß-Grenzen</h3><div class="sub">Ab diesen Kilometern wechselt die Anzeige auf gelb bzw. rot.</div>
  ${rows.map(([k, n, img]) => `<div class="limrow"><div class="ln"><img src="${img}" alt="" width="26" height="26">${n}</div><div class="two">${stp('#C98A00', 'Gelb ab', k, 0)}${stp('#C0392B', 'Rot ab', k, 1)}</div></div>`).join('')}
  <div id="sherr"></div></div>`;
}

export function newView(bikes, wheelsets, links, rides, today, form = {}) {
  const act = bikes.filter((b) => b.status === 'aktiv'); const sel = form.bike || act[0]?.id;
  const wsFor = (bid) => links.filter((l) => same(l.bike_id, bid)).map((l) => wheelsets.find((w) => same(w.id, l.wheelset_id))).filter(Boolean);
  const fld = (id, lab, ph, mode = 'text', unit = '', span = '', v = '') => `<div class="fld" style="${span}"><label for="${id}">${lab}</label><div class="inp"><input id="${id}" inputmode="${mode}" placeholder="${ph}" value="${esc(v)}" autocomplete="off"><span>${unit}</span></div></div>`;
  const opt = '<span class="opt">optional</span>';
  const chips = (key, list, selId) => `<div class="chiprow" data-group="${key}">${list.map((c) => `<button type="button" class="chipbtn${same(c.id, selId) ? ' on' : ''}" data-v="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div>`;
  const today10 = today.toISOString().slice(0, 10);
  const chg = Object.entries(PARTS).map(([k, [n, img]]) => `<button type="button" class="chg" data-chg="${k}"><img src="${img}" alt="" width="28" height="28"><span>${n}<em>${k === 'ritzel' || k === 'reifen' ? 'am Laufradsatz' : 'am Rad'}</em></span><i class="ck" aria-hidden="true">✓</i></button>`).join('');
  return `<div class="top"><button class="rb" id="back" aria-label="Zurück">${svg('back', 18, 2.2)}</button><div class="grow"><div class="sub">Neue Aktivität</div><h1 class="small">Fahrt erfassen</h1></div></div>
  <div id="saved"></div>
  <button type="button" class="ghostbtn" id="copylast">Letzte Fahrt kopieren</button>
  <div class="card"><h2>Pflichtangaben</h2><div class="g2"><div class="fld"><label for="f-date">Datum</label><div class="inp"><input id="f-date" type="date" value="${today10}"></div></div>${fld('f-km', 'Kilometer', '0,0', 'decimal', 'km')}</div></div>
  <div class="card"><h2>Rad &amp; Laufradsatz</h2><div class="sub">Rad</div>${chips('bike', act, sel)}<div class="sub">Laufradsatz</div><div id="wsbox">${chips('ws', wsFor(sel).map((w) => ({ id: w.id, label: w.name })), form.ws)}</div>
    <div class="g2">${fld('f-place', 'Ort', 'z. B. München')}</div><div class="sub">Art</div>${chips('art', ['Training', 'Rennen', 'virtuell'].map((a) => ({ id: a, label: a })), form.art || 'Training')}</div>
  <button type="button" class="ghostbtn tint" id="more" aria-expanded="false">Details &amp; Messwerte ▾</button>
  <div id="morebox" hidden>
    <div class="card"><h2>Details ${opt}</h2><div class="g2">${fld('f-name', 'Name', 'Fahrtname', 'text', '', 'grid-column:1/-1')}${fld('f-time', 'Uhrzeit', '08:30', 'numeric', 'Uhr')}${fld('f-hm', 'Höhenmeter', '0', 'numeric', 'hm')}${fld('f-fz', 'Fahrtzeit', '2:32:10', 'numeric', 'h:mm:ss')}${fld('f-gz', 'Gesamtzeit', '2:45:00', 'numeric', 'h:mm:ss')}${fld('f-avg', 'Ø Tempo', 'automatisch', 'decimal', 'km/h')}${fld('f-mx', 'Max. Tempo', '0,0', 'decimal', 'km/h')}${fld('f-pw', 'Ø Leistung', '0', 'numeric', 'W')}</div>${fld('f-desc', 'Beschreibung', 'Notizen zur Fahrt')}</div>
    <div class="card"><h2>Messwerte ${opt}</h2><div class="g2">${fld('f-hra', 'Ø Puls', '–', 'numeric', 'bpm')}${fld('f-hrm', 'Max. Puls', '–', 'numeric', 'bpm')}${fld('f-cada', 'Ø Trittfrequenz', '–', 'numeric', 'rpm')}${fld('f-cadm', 'Max. Trittfrequenz', '–', 'numeric', 'rpm')}${fld('f-tmp', 'Temperatur', '–', 'decimal', '°C')}${fld('f-np', 'Gewichtete Leistung', '–', 'numeric', 'W')}</div></div></div>
  <div class="card"><h2>Teile gewechselt?</h2><div class="sub">Setzt den Zähler des Teils ab dieser Fahrt auf 0 km.</div><div class="g2">${chg}</div></div>
  <div id="err"></div><button type="button" id="save" class="savebtn">Fahrt speichern</button>`;
}
