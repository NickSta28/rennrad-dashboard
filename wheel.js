// Walzen-Auswahl (Bottom-Sheet) für Uhrzeit und Dauer
const H = 40;
export function openWheel({ title, cols, value, onDone, onClear }) {
  const wrap = document.createElement('div'); wrap.className = 'wheelwrap';
  const colHtml = cols.map((c, i) => `<div class="wcolbox"><div class="wlab">${c.label}</div><div class="wcol" data-i="${i}" tabindex="0" aria-label="${c.label}"><div class="wpad"></div>${Array.from({ length: c.n }, (_, k) => `<div class="wit" data-v="${k}">${String(k).padStart(c.pad || 1, '0')}</div>`).join('')}<div class="wpad"></div></div></div>`).join('<div class="wsep">:</div>');
  wrap.innerHTML = `<div class="wback"></div><div class="wsheet" role="dialog" aria-label="${title}"><div class="wtitle">${title}</div><div class="wcols"><div class="wband"></div>${colHtml}</div>
    <div class="wbtns"><button type="button" class="ghost" data-a="clear">Leeren</button><button type="button" class="ghost" data-a="cancel">Abbrechen</button><button type="button" data-a="ok">Fertig</button></div></div>`;
  document.body.appendChild(wrap);
  const cs = [...wrap.querySelectorAll('.wcol')];
  requestAnimationFrame(() => cs.forEach((c, i) => { c.scrollTop = (value[i] || 0) * H; }));
  const close = () => wrap.remove();
  wrap.querySelector('.wback').onclick = close;
  wrap.querySelector('[data-a=cancel]').onclick = close;
  wrap.querySelector('[data-a=clear]').onclick = () => { close(); onClear && onClear(); };
  wrap.querySelector('[data-a=ok]').onclick = () => {
    const v = cs.map((c, i) => Math.min(cols[i].n - 1, Math.max(0, Math.round(c.scrollTop / H)))); close(); onDone(v);
  };
}
