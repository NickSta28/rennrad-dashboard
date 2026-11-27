// HTML-Erzeugung für Übersicht und Räder (reine Funktionen, Node-testbar)
import { MON, MONL, CLASSES, yearOverview, pulseCard, wear, bikeStats, years } from './compute.js';

export const de = (n, d = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const dmy = (d) => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '–');
const dm = (d) => d.slice(8, 10) + '.' + d.slice(5, 7) + '.';
const LV = [['#4C7A4A', '#E3F1E1', 'OK'], ['#C98A00', '#FBEFC9', 'Bald fällig'], ['#C0392B', '#F8DAD6', 'Wechsel fällig']];
const PART = { kette: 'Kette', ritzel: 'Ritzel', reifen: 'Reifen', bremsscheibe: 'Bremsscheiben' };

function bars(vals, labels, { h = 90, color = 'var(--accent)', prev = null, fmt = (v) => de(v) } = {}) {
  const max = Math.max(1, ...vals, ...(prev || [0])); const w = 300; const bw = w / vals.length;
  return `<svg viewBox="0 0 ${w} ${h + 18}" class="chart" role="img" aria-label="Balkendiagramm">${vals.map((v, i) => {
    const bh = v / max * h; const ph = prev ? prev[i] / max * h : 0;
    return `${prev ? `<rect x="${i * bw + 1}" y="${h - ph}" width="${bw / 2 - 1}" height="${ph}" fill="var(--prior)" rx="2"/>` : ''}<rect x="${i * bw + (prev ? bw / 2 : 2)}" y="${h - bh}" width="${prev ? bw / 2 - 1 : bw - 4}" height="${bh}" fill="${color}" rx="2"><title>${labels[i]}: ${fmt(v)}</title></rect><text x="${i * bw + bw / 2}" y="${h + 13}" text-anchor="middle" class="ax">${labels[i]}</text>`;
  }).join('')}</svg>`;
}

function curve(o) {
  const w = 300, h = 120; const maxY = Math.max(o.goal, o.km, ...(o.cumPrev.length ? [o.cumPrev.at(-1)[1]] : [0])) * 1.05;
  const X = (d) => d / o.total * w; const Y = (v) => h - v / maxY * h;
  const path = (pts) => 'M0,' + h + ' ' + pts.map(([d, v]) => `L${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const cur = o.cum.length ? o.cum : [[0, 0]];
  return `<svg viewBox="0 0 ${w} ${h + 4}" class="chart" role="img" aria-label="Kumulierte Kilometer im Jahresverlauf">
    <line x1="0" y1="${h}" x2="${w}" y2="${Y(o.goal)}" stroke="var(--mute)" stroke-dasharray="4 4"/>
    ${o.cumPrev.length ? `<path d="${path(o.cumPrev)}" fill="none" stroke="var(--prior)" stroke-width="2"/>` : ''}
    <path d="${path(cur)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/></svg>
    <div class="legend"><span><i style="background:var(--accent)"></i>${o.year}</span><span><i style="background:var(--prior)"></i>${o.year - 1}</span><span><i class="dash"></i>Ziel ${de(o.goal)} km</span></div>`;
}

export function overviewView(rides, bikes, year, today, settings = {}) {
  const yrs = years(rides); if (!yrs.length) return '<div class="card">Noch keine Fahrten.</div>';
  const o = yearOverview(rides, bikes, year, today, settings.goal || 4500);
  const chip = o.cur ? (o.ahead >= 0 ? ['on track', 'ok'] : ['im Rückstand', 'warn']) : (o.km >= o.goal ? ['Ziel erreicht', 'ok'] : ['Ziel verfehlt', 'warn']);
  const hs = o.cur ? [['Vorsprung', (o.ahead >= 0 ? '+' : '−') + de(Math.abs(o.ahead)) + ' %'], ['Noch offen', de(o.open) + ' km'], ['Nötig pro Woche', de(o.perWeek) + ' km']]
    : [['Ziel-Quote', de(o.pct) + ' %'], ['Differenz', (o.km >= o.goal ? '+' : '−') + de(Math.abs(o.km - o.goal)) + ' km'], ['Fahrten', de(o.n)]];
  const pc = pulseCard(rides);
  return `
  <div class="card hero"><div class="row"><h2>Jahresziel ${year}</h2><span class="chip ${chip[1]}">${chip[0]}</span></div>
    <div class="big">${de(o.km)}<small> von ${de(o.goal)} km</small></div>
    <div class="prog" role="progressbar" aria-valuenow="${Math.round(o.pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, o.pct)}%"></i>${o.cur ? `<b style="left:${o.timePct}%"></b>` : ''}</div>
    <div class="sub">${Math.round(o.pct)} % der Kilometer${o.cur ? ` · Zeit: ${Math.round(o.timePct)} %` : ''}</div>
    <div class="trio">${hs.map((h) => `<div><span>${h[0]}</span><b>${h[1]}</b></div>`).join('')}</div></div>
  <div class="kpis">
    <div class="kpi"><span>Fahrten</span><b>${de(o.n)}</b><em>${o.over100} über 100 km</em></div>
    <div class="kpi"><span>Kilometer</span><b>${de(o.km)}</b><em>Ø ${de(o.n ? o.km / o.n : 0, 1)} km je Fahrt</em></div>
    <div class="kpi"><span>Höhenmeter</span><b>${de(o.hm)}</b><em>Ø ${de(o.n ? o.hm / o.n : 0)} Hm je Fahrt</em></div>
    <div class="kpi"><span>Höchster Ø-Speed</span><b>${o.speed ? de(o.speed.avg_speed, 1) : '–'}<small> km/h</small></b><em>${o.speed ? 'Fahrt im ' + MONL[+o.speed.datum.slice(5, 7) - 1] : ''}</em></div></div>
  ${pc ? pulseHtml(pc) : ''}
  <div class="card"><h2>Kilometer im Jahresverlauf</h2>${curve(o)}</div>
  <div class="card"><h2>Kilometer je Monat</h2>${bars(o.mon, MON, { prev: o.prev })}
    <div class="legend"><span><i style="background:var(--accent)"></i>${year}</span><span><i style="background:var(--prior)"></i>${year - 1}</span></div>
    <div class="sub">Bester Monat: ${MONL[o.best.m]} mit ${de(o.best.km)} km</div></div>
  <div class="card"><h2>Fahrten je Wochentag</h2>${bars(o.wd, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], { h: 70 })}</div>
  <div class="card"><h2>Anteil je Rad</h2>${o.shares.map((s) => `<div class="share"><div class="row"><span>${esc(s.bike?.label || '?')}</span><b>${de(s.km)} km · ${Math.round(s.pct)} %</b></div><div class="bar"><i style="width:${s.pct}%"></i></div></div>`).join('')}</div>
  <div class="card"><h2>Letzte Fahrten</h2>${o.last.map((r) => `<div class="ride"><div><b>${esc(r.name || 'Fahrt')}</b><span>${dm(r.datum)} · ${esc(bikes.find((b) => b.id === r.bike_id)?.label || '')} · ${de(r.elevation_m || 0)} Hm${r.avg_speed ? ' · ' + de(r.avg_speed, 1) + ' km/h' : ''}</span></div><b>${de(r.km || 0, 1)} km</b></div>`).join('')}</div>
  <div class="card"><h2>Vergleich bis zum ${o.cur ? dm(today.toISOString().slice(0, 10)) : '31.12.'}</h2>${o.others.map((x) => `<div class="row cmp"><span>${x.year}: ${de(x.km)} km</span><b class="${x.delta >= 0 ? 'good' : 'bad'}">${x.delta >= 0 ? '+' : '−'}${de(Math.abs(x.delta))} km</b></div>`).join('')}
    <div class="row cmp"><span>Ziel-Pace: ${de(o.pace)} km</span><b class="${o.km - o.pace >= 0 ? 'good' : 'bad'}">${o.km - o.pace >= 0 ? '+' : '−'}${de(Math.abs(o.km - o.pace))} km</b></div></div>`;
}

function pulseHtml(pc) {
  const lo = 100, hi = 180, h = 80, w = 300; const bw = w / pc.recent.length;
  const Y = (v) => h - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * h;
  const ok = pc.diff <= 0;
  return `<div class="card"><h2>Puls</h2>
    <div class="row"><div class="big">${de(pc.last.avg_hr)}<small> bpm Ø</small></div><span class="chip ${ok ? 'ok' : 'warn'}">${pc.diff >= 0 ? '+' : '−'}${de(Math.abs(pc.diff), 0)} gegenüber Ø</span></div>
    <div class="sub">Letzte Fahrt mit Puls (${dmy(pc.last.datum)}, ${esc(pc.art)}) · Ø seit ${pc.since} (${esc(pc.art)}): ${de(pc.avg)} bpm, ${de(pc.n)} Fahrten</div>
    <svg viewBox="0 0 ${w} ${h + 4}" class="chart" role="img" aria-label="Durchschnittspuls der letzten 20 Fahrten">${pc.recent.map((r, i) => `<rect x="${i * bw + 2}" y="${Y(r.avg_hr)}" width="${bw - 4}" height="${h - Y(r.avg_hr)}" fill="${i === pc.recent.length - 1 ? 'var(--accent)' : 'var(--lvl1)'}" rx="2"><title>${dm(r.datum)}: ${r.avg_hr} bpm</title></rect>`).join('')}
    <line x1="0" x2="${w}" y1="${Y(pc.avg)}" y2="${Y(pc.avg)}" stroke="var(--mute)" stroke-dasharray="4 4"/></svg>
    <div class="sub">Letzte 20 Fahrten mit Puls · Achse ab 100 bpm</div></div>`;
}

export function bikesView(rides, bikes, wheelsets, links, changes, sel, limits) {
  const act = bikes.filter((b) => rides.some((r) => r.bike_id === b.id)).sort((a, b) => (a.status === b.status ? a.sort - b.sort : a.status === 'aktiv' ? -1 : 1));
  const bike = bikes.find((b) => b.id === sel) || act[0]; if (!bike) return '<div class="card">Keine Räder.</div>';
  const st = bikeStats(rides, bike);
  const wsOf = links.filter((l) => l.bike_id === bike.id).map((l) => wheelsets.find((w) => w.id === l.wheelset_id)).filter(Boolean);
  const wsKm = (w) => rides.filter((r) => r.wheelset_id === w.id).reduce((s, r) => s + Number(r.km || 0), 0);
  const wearRows = [wear('kette', bike.id, rides, changes, limits), wear('bremsscheibe', bike.id, rides, changes, limits)].filter(Boolean).map((w) => ({ ...w, owner: bike.label }))
    .concat(wsOf.flatMap((w) => ['ritzel', 'reifen'].map((p) => { const x = wear(p, w.id, rides, changes, limits); return x && { ...x, owner: w.name }; }).filter(Boolean)));
  const rec = (r, label, val, unit) => r ? `<div class="rec"><b>${val}<small> ${unit}</small></b><span>${label}</span><em>${dmy(r.datum)} · ${esc(r.name || '')}</em></div>` : '';
  return `
  <div class="chips" role="tablist">${act.map((b) => `<button class="chipbtn${b.id === bike.id ? ' on' : ''}" data-bike="${b.id}" role="tab" aria-selected="${b.id === bike.id}">${esc(b.label)}</button>`).join('')}</div>
  <div class="card bikehead">${bike.photo_path ? `<img src="${esc(bike.photo_path)}" alt="${esc(bike.full_name)}" loading="lazy">` : '<div class="ph" aria-hidden="true">🚲</div>'}
    <div class="row"><h2>${esc(bike.full_name || bike.label)}</h2><span class="chip ${bike.status === 'aktiv' ? 'ok' : 'mute'}">${esc(bike.status)}</span></div>
    <dl><dt>Kilometer</dt><dd>${de(st.km)}</dd><dt>Fahrten</dt><dd>${de(st.n)}</dd><dt>Erste Fahrt</dt><dd>${dmy(st.first)}</dd><dt>Letzte Fahrt</dt><dd>${dmy(st.last)}</dd></dl></div>
  <div class="card"><h2>Verschleiß</h2>${wearRows.length ? wearRows.map((w) => { const l = LV[w.lvl]; return `<div class="wear"><div class="row"><span>${PART[w.part]} <em>${esc(w.owner)}</em></span><span class="chip" style="background:${l[1]};color:${l[0]}">${l[2]}</span></div>
      <div class="bar"><i style="width:${w.pct}%;background:${l[0]}"></i></div><div class="sub">${de(w.km)} km seit ${dmy(w.since)}${w.fromFirstRide ? ' (erste Fahrt)' : ''} · gelb ab ${de(w.yellow)}, rot ab ${de(w.red)}</div></div>`; }).join('') : '<div class="sub">Keine Daten.</div>'}</div>
  <div class="card"><h2>Rekorde</h2><div class="recs">${rec(st.longest, 'Längste Fahrt', de(st.longest?.km || 0, 1), 'km')}${rec(st.fastest, 'Schnellste Fahrt', de(st.fastest?.avg_speed || 0, 1), 'km/h')}${rec(st.climb, 'Meiste Höhenmeter', de(st.climb?.elevation_m || 0), 'hm')}</div></div>
  ${wsOf.length ? `<div class="card"><h2>Laufräder</h2>${wsOf.map((w) => `<div class="row cmp"><span>${esc(w.name)}</span><b>${de(wsKm(w))} km · ${esc(w.status)}</b></div>`).join('')}</div>` : ''}
  <div class="card"><h2>Fahrten je Jahr und Länge</h2><div class="tbl"><table><thead><tr><th>Jahr</th><th>Fahrten</th><th>km</th>${CLASSES.map((c) => `<th>${c[2]}</th>`).join('')}</tr></thead>
    <tbody>${st.perYear.map((y) => `<tr><td>${y.year}</td><td>${y.n}</td><td>${de(y.km)}</td>${y.cls.map((c) => `<td>${c || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
