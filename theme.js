// Farbschema: alle Töne entstehen aus einer Akzentfarbe (Mischung mit Weiß)
export const ACCENTS = [['Blau', '#1D4ED8'], ['Weinrot', '#7A1F35'], ['Terrakotta', '#B5401C'], ['Petrol', '#0F766E']];
export const mix = (hex, t) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
export function applyTheme(accent) {
  const a = ACCENTS.some((x) => x[1] === accent) ? accent : ACCENTS[0][1];
  const s = document.documentElement.style;
  s.setProperty('--accent', a); s.setProperty('--bg', mix(a, .955)); s.setProperty('--line', mix(a, .86)); s.setProperty('--tint', mix(a, .86));
  s.setProperty('--tintLine', mix(a, .74)); s.setProperty('--prior', mix(a, .72)); s.setProperty('--lvl1', mix(a, .78));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', a);
  try { localStorage.setItem('rd-accent', a); } catch (e) { /* ignorieren */ }
  return a;
}
export function savedAccent() { try { return localStorage.getItem('rd-accent'); } catch (e) { return null; } }
