// Reine Berechnungen für Übersicht und Räder (Browser und Node). Eingabe: Zeilen aus rad.* in DB-Form.
export const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const DEFAULT_LIMITS = { kette: [1500, 3000], ritzel: [2000, 4000], reifen: [1500, 3000], bremse: [2000, 4000] };
export const CLASSES = [[0, 50, '<50'], [50, 75, '–75'], [75, 100, '–100'], [100, 125, '–125'], [125, 150, '–150'], [150, 1e9, '150+']];

const num = (v) => (v == null || v === '' ? 0 : Number(v));
const yearOf = (d) => +d.slice(0, 4);
const monthOf = (d) => +d.slice(5, 7);
const ymd = (d) => d.toISOString().slice(0, 10);
export const doy = (d) => Math.floor((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(+d.slice(0, 4), 0, 0)) / 864e5);
const daysInYear = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const wdOf = (d) => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; // Mo=0

export function years(rides) { return [...new Set(rides.map((r) => yearOf(r.datum)))].sort((a, b) => b - a); }

export function yearOverview(rides, bikes, year, today, goal = 4500) {
  const t = ymd(today); const cur = yearOf(t) === year;
  const upTo = cur ? doy(t) : daysInYear(year);
  const s = rides.filter((r) => yearOf(r.datum) === year);
  const km = sum(s, (r) => num(r.km)); const hm = sum(s, (r) => num(r.elevation_m));
  const speed = s.filter((r) => r.art !== 'virtuell' && num(r.avg_speed) > 0).sort((a, b) => b.avg_speed - a.avg_speed)[0] || null;
  const months = (arr) => Array.from({ length: 12 }, (_, i) => sum(arr.filter((r) => monthOf(r.datum) === i + 1), (r) => num(r.km)));
  const mon = months(s); const prev = months(rides.filter((r) => yearOf(r.datum) === year - 1));
  const bi = mon.indexOf(Math.max(...mon));
  const byBike = {}; s.forEach((r) => { byBike[r.bike_id] = (byBike[r.bike_id] || 0) + num(r.km); });
  const shares = Object.entries(byBike).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ bike: bikes.find((b) => String(b.id) === String(id)), km: v, pct: km ? v / km * 100 : 0 }));
  const kmAt = (y, d) => sum(rides.filter((r) => yearOf(r.datum) === y && doy(r.datum) <= d), (r) => num(r.km));
  const others = years(rides).filter((y) => y !== year && y >= year - 2).map((y) => ({ year: y, km: kmAt(y, upTo), delta: kmAt(year, upTo) - kmAt(y, upTo) }));
  const total = daysInYear(year); const pace = goal * upTo / total;
  const cum = []; let acc = 0; const sorted = [...s].sort((a, b) => a.datum.localeCompare(b.datum));
  sorted.forEach((r) => { acc += num(r.km); cum.push([doy(r.datum), acc]); });
  const cumPrev = []; acc = 0; rides.filter((r) => yearOf(r.datum) === year - 1).sort((a, b) => a.datum.localeCompare(b.datum)).forEach((r) => { acc += num(r.km); cumPrev.push([doy(r.datum), acc]); });
  const cumOf = (y) => { let a = 0; return rides.filter((r) => yearOf(r.datum) === y).sort((p, q) => p.datum.localeCompare(q.datum)).map((r) => { a += num(r.km); return [doy(r.datum), a]; }); };
  const cumYears = [year, year - 1, year - 2].map((y) => ({ year: y, pts: cumOf(y) }));
  const weeksLeft = Math.max(1, Math.ceil((total - upTo) / 7));
  return {
    year, cur, n: s.length, km, hm, over100: s.filter((r) => num(r.km) >= 100).length, speed, mon, prev, best: { m: bi, km: mon[bi] },
    wd: Array.from({ length: 7 }, (_, i) => s.filter((r) => wdOf(r.datum) === i).length), shares, others,
    last: [...s].sort((a, b) => (b.datum + (b.uhrzeit || '')).localeCompare(a.datum + (a.uhrzeit || ''))).slice(0, 5),
    goal, pct: km / goal * 100, timePct: upTo / total * 100, pace, ahead: pace ? (km / pace - 1) * 100 : 0, open: Math.max(0, goal - km), perWeek: Math.max(0, goal - km) / weeksLeft,
    cum, cumPrev, cumYears, upTo, total,
  };
}

// Pulskarte: letzte Fahrt mit Puls gegen den langjährigen Schnitt gleicher Art, plus letzte 20 Fahrten
export function pulseCard(rides) {
  const hr = rides.filter((r) => num(r.avg_hr) > 0).sort((a, b) => (a.datum + (a.uhrzeit || '')).localeCompare(b.datum + (b.uhrzeit || '')));
  if (!hr.length) return null;
  const last = hr[hr.length - 1]; const same = hr.filter((r) => r.art === last.art);
  const avg = sum(same, (r) => r.avg_hr) / same.length;
  return { last, avg, diff: last.avg_hr - avg, art: last.art, since: same[0].datum.slice(0, 4), n: same.length, recent: hr.slice(-20) };
}

// Verschleiß: letzter Wechsel; ohne Eintrag zählt die erste Fahrt von Rad bzw. Laufradsatz
export function wear(part, owner, rides, changes, limits = DEFAULT_LIMITS) {
  const isBike = part === 'kette' || part === 'bremsscheibe';
  const key = isBike ? 'bike_id' : 'wheelset_id'; const cfg = limits[part === 'bremsscheibe' ? 'bremse' : part];
  const mine = rides.filter((r) => String(r[key]) === String(owner));
  if (!mine.length) return null;
  const ch = changes.filter((c) => c.part === part && String(c[key]) === String(owner)).map((c) => c.datum).sort();
  const since = ch.length ? ch[ch.length - 1] : mine.reduce((m, r) => (r.datum < m ? r.datum : m), mine[0].datum);
  const km = sum(mine.filter((r) => r.datum >= since), (r) => num(r.km));
  const lvl = km >= cfg[1] ? 2 : km >= cfg[0] ? 1 : 0;
  return { part, since, fromFirstRide: !ch.length, km, lvl, yellow: cfg[0], red: cfg[1], pct: Math.min(100, km / cfg[1] * 100) };
}

export function bikeStats(rides, bike) {
  const s = rides.filter((r) => String(r.bike_id) === String(bike.id));
  if (!s.length) return { n: 0, km: 0 };
  const by = (f) => s.reduce((m, r) => (num(f(r)) > num(f(m)) ? r : m), s[0]);
  const sp = s.filter((r) => r.art !== 'virtuell');
  const dates = s.map((r) => r.datum).sort();
  const perYear = {}; s.forEach((r) => { const y = yearOf(r.datum); (perYear[y] ||= { n: 0, km: 0, cls: CLASSES.map(() => 0) }); perYear[y].n++; perYear[y].km += num(r.km); const k = num(r.km); const i = CLASSES.findIndex((c) => k >= c[0] && k < c[1]); if (i >= 0 && k > 0) perYear[y].cls[i]++; });
  return {
    n: s.length, km: sum(s, (r) => num(r.km)), first: dates[0], last: dates[dates.length - 1],
    longest: by((r) => r.km), fastest: sp.length ? sp.reduce((m, r) => (num(r.avg_speed) > num(m.avg_speed) ? r : m), sp[0]) : null, climb: by((r) => r.elevation_m),
    perYear: Object.entries(perYear).sort((a, b) => b[0] - a[0]).map(([y, v]) => ({ year: +y, ...v })),
  };
}

// Vier Verschleißteile eines Rads: Kette und Bremsscheiben am Rad, Ritzel und Reifen am zuletzt gefahrenen Laufradsatz
export function bikeWear(bike, rides, changes, wheelsets, limits) {
  const mine = rides.filter((r) => String(r.bike_id) === String(bike.id));
  const lastWs = mine.filter((r) => r.wheelset_id != null).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const ws = lastWs && wheelsets.find((w) => String(w.id) === String(lastWs.wheelset_id));
  const rows = [];
  const add = (part, owner, label) => { const w = wear(part, owner, rides, changes, limits); if (w) rows.push({ ...w, owner: label }); };
  add('kette', bike.id, null);
  if (ws) add('ritzel', ws.id, ws.name);
  if (ws) add('reifen', ws.id, ws.name);
  add('bremsscheibe', bike.id, null);
  return rows;
}

// Mittelwert der kumulierten Kilometer am Monatsende über alle Jahre von..bis (laufendes Jahr nur bis zum letzten vollen Monat)
export const MONTH_END = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
export function rangeAvg(rides, from, to, today) {
  const t = today.toISOString().slice(0, 10); const out = [];
  for (let m = 0; m < 12; m++) {
    const vals = [];
    for (let y = Math.min(from, to); y <= Math.max(from, to); y++) {
      const last = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
      if (last > t) continue;
      const ys = rides.filter((r) => yearOf(r.datum) === y); if (!ys.length) continue;
      vals.push(sum(ys.filter((r) => r.datum <= last), (r) => num(r.km)));
    }
    out.push(vals.length ? sum(vals, (v) => v) / vals.length : null);
  }
  return { vals: out, years: Math.abs(to - from) + 1 };
}
