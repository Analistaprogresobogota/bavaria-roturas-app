// Graficas del Tablero, hechas en SVG a mano (mismo enfoque probado del
// prototipo original: nada de librerias de charts). Cada funcion recibe el
// contenedor DOM (via ref de React) y le llena el innerHTML — se llaman
// desde un useEffect cada vez que cambian los datos filtrados.
export const PAL = ['#0d3b66', '#f4a259', '#2a9d8f', '#b23a48', '#6a7fdb', '#3aa6a0', '#e07a1f', '#8d99ae'];
export const TCOL = { A: '#0d3b66', B: '#f4a259', C: '#2a9d8f' };

function esc(s) {
  return (s == null ? '' : '' + s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function tally(R, fn) {
  const m = {};
  R.forEach((r) => {
    const k = fn(r) || '—';
    m[k] = (m[k] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export function tallySum(R, fn, val) {
  const m = {};
  R.forEach((r) => {
    const k = fn(r) || '—';
    m[k] = (m[k] || 0) + (+val(r) || 0);
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function tipOn(tipEl, e, html) {
  tipEl.innerHTML = html;
  tipEl.classList.add('show');
  tipMove(tipEl, e);
}
function tipMove(tipEl, e) {
  tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 240) + 'px';
  tipEl.style.top = Math.max(e.clientY - 52, 8) + 'px';
}
function tipOff(tipEl) {
  tipEl.classList.remove('show');
}
function bind(tipEl, el, html) {
  el.addEventListener('mouseenter', (e) => tipOn(tipEl, e, html));
  el.addEventListener('mousemove', (e) => tipMove(tipEl, e));
  el.addEventListener('mouseleave', () => tipOff(tipEl));
  el.addEventListener('touchstart', (e) => tipOn(tipEl, e.touches[0], html), { passive: true });
}

export function spark(s) {
  if (!s.length) return '';
  const w = 110,
    h = 34,
    mx = Math.max(...s, 1);
  const pts = s.map((v, i) => [(i / (s.length - 1 || 1)) * w, h - (v / mx) * (h - 4) - 2]);
  const dd = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${dd} L ${w} ${h} L 0 ${h} Z" fill="#0d3b66" opacity=".25"/><path d="${dd}" fill="none" stroke="#0d3b66" stroke-width="2"/></svg>`;
}

export function renderKpis(host, R, periodoDias) {
  const und = R.reduce((a, r) => a + (+r.cantidad || 0), 0);
  const dias = Math.min(periodoDias, 30);
  const perDay = {};
  R.forEach((r) => (perDay[r.fecha] = (perDay[r.fecha] || 0) + 1));
  const series = [];
  const d = new Date();
  for (let i = dias - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() - i);
    series.push(perDay[dd.toISOString().slice(0, 10)] || 0);
  }
  const half = Math.floor(series.length / 2);
  const a = series.slice(0, half).reduce((x, y) => x + y, 0);
  const b = series.slice(half).reduce((x, y) => x + y, 0);
  const delta = a ? Math.round(((b - a) / a) * 100) : 0;
  const cls = delta > 4 ? 'up' : delta < -4 ? 'dn' : 'fl';
  const arrow = delta > 4 ? '▲' : delta < -4 ? '▼' : '▬';
  const tu = tally(R, (r) => r.ubicacion);
  const conFoto = R.filter((r) => r.foto_conciliador).length;
  const cards = [
    { l: 'Reportes', v: R.length, d: `${arrow} ${Math.abs(delta)}% vs. periodo previo`, c: cls },
    { l: 'Cantidad total', v: und, d: R.length ? (und / R.length).toFixed(1) + ' und por reporte' : '—', c: 'fl' },
    { l: 'Ubicación crítica', v: tu.length ? tu[0][0] : '—', d: tu.length ? tu[0][1] + ' reportes' : '—', c: 'fl', sm: 1 },
    {
      l: 'Conciliación con foto',
      v: (R.length ? Math.round((conFoto / R.length) * 100) : 0) + '%',
      d: `${conFoto} de ${R.length} con evidencia`,
      c: conFoto / (R.length || 1) < 0.7 ? 'up' : 'dn',
    },
  ];
  host.innerHTML = cards
    .map((c) => `<div class="dkpi"><div class="l">${c.l}</div><div class="v${c.sm ? ' sm' : ''}">${esc(c.v)}</div><div class="d ${c.c}">${c.d}</div>${spark(series)}</div>`)
    .join('');
}

export function renderTrend(hostChart, hostN, R, periodoDias, tipEl) {
  const dias = Math.min(periodoDias, 30);
  const m = {};
  R.forEach((r) => (m[r.fecha] = (m[r.fecha] || 0) + 1));
  const labels = [];
  const vals = [];
  const d = new Date();
  for (let i = dias - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() - i);
    const k = dd.toISOString().slice(0, 10);
    labels.push(k);
    vals.push(m[k] || 0);
  }
  hostN.textContent = `${vals.reduce((a, b) => a + b, 0)} reportes / ${dias} días`;
  const W = 640,
    H = 190,
    pl = 30,
    pr = 8,
    pt = 12,
    pb = 26;
  const mx = Math.max(...vals, 3),
    iw = W - pl - pr,
    ih = H - pt - pb;
  const X = (i) => pl + (vals.length > 1 ? (i / (vals.length - 1)) * iw : iw / 2);
  const Y = (v) => pt + ih - (v / mx) * ih;
  let grid = '';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const yv = Math.round((mx / ticks) * i),
      y = Y(yv);
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="#e8eef4" stroke-width="1"/><text x="${pl - 7}" y="${y + 4}" font-size="10" fill="#647184" text-anchor="end">${yv}</text>`;
  }
  const line = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  const area = line + ` L ${X(vals.length - 1)} ${pt + ih} L ${X(0)} ${pt + ih} Z`;
  let xl = '';
  const stepL = Math.ceil(vals.length / 6);
  labels.forEach((l, i) => {
    if (i % stepL === 0 || i === labels.length - 1) xl += `<text x="${X(i)}" y="${H - 7}" font-size="9.5" fill="#647184" text-anchor="middle">${l.slice(8)}/${l.slice(5, 7)}</text>`;
  });
  const dots = vals.map((v, i) => `<circle class="dot" data-i="${i}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="#fff" stroke="#0d3b66" stroke-width="2.5"/>`).join('');
  hostChart.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0d3b66" stop-opacity=".28"/><stop offset="100%" stop-color="#0d3b66" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#gArea)"/><path d="${line}" fill="none" stroke="#0d3b66" stroke-width="2.5" stroke-linejoin="round"/>${dots}${xl}</svg>`;
  hostChart.querySelectorAll('.dot').forEach((el) => {
    const i = +el.dataset.i;
    bind(tipEl, el, `<b>${labels[i]}</b><br>${vals[i]} reporte${vals[i] === 1 ? '' : 's'}`);
  });
}

export function renderDonut(host, data, colorMap, unit, tipEl) {
  if (!data.length) {
    host.innerHTML = '<p class="help">Sin datos en este filtro.</p>';
    return;
  }
  const tot = data.reduce((a, b) => a + b[1], 0),
    S = 200,
    c = S / 2,
    rO = 88,
    rI = 56;
  let ang = -Math.PI / 2,
    paths = '';
  data.forEach(([k, val], i) => {
    const col = (colorMap && colorMap[k]) || PAL[i % PAL.length];
    const a2 = ang + (val / tot) * Math.PI * 2,
      big = a2 - ang > Math.PI ? 1 : 0;
    const p = (r, a) => [c + r * Math.cos(a), c + r * Math.sin(a)];
    const [x1, y1] = p(rO, ang),
      [x2, y2] = p(rO, a2),
      [x3, y3] = p(rI, a2),
      [x4, y4] = p(rI, ang);
    paths += `<path class="slice" data-k="${esc(k)}" d="M${x1} ${y1} A${rO} ${rO} 0 ${big} 1 ${x2} ${y2} L${x3} ${y3} A${rI} ${rI} 0 ${big} 0 ${x4} ${y4} Z" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    ang = a2;
  });
  const idC = 'c' + Math.random().toString(36).slice(2, 8);
  host.innerHTML =
    `<svg class="chart" viewBox="0 0 ${S} ${S}" style="max-width:230px;margin:0 auto">${paths}<text x="${c}" y="${c - 4}" text-anchor="middle" font-size="30" font-weight="800" fill="#0d3b66" id="${idC}V">${tot}</text><text x="${c}" y="${c + 16}" text-anchor="middle" font-size="10.5" fill="#647184" id="${idC}L">${unit}</text></svg>` +
    `<div class="legend">${data
      .map(([k, val], i) => {
        const col = (colorMap && colorMap[k]) || PAL[i % PAL.length];
        return `<div data-k="${esc(k)}"><i style="background:${col}"></i><b>${esc(k)}</b> ${Math.round((val / tot) * 100)}%</div>`;
      })
      .join('')}</div>`;
  const cv = host.querySelector('#' + idC + 'V');
  const cl = host.querySelector('#' + idC + 'L');
  const focus = (k) => {
    const val = data.find((x) => x[0] === k)[1];
    host.querySelectorAll('.slice').forEach((s) => s.classList.toggle('dim', s.dataset.k !== k));
    cv.textContent = val;
    cl.textContent = k.length > 16 ? k.slice(0, 15) + '…' : k;
  };
  const reset = () => {
    host.querySelectorAll('.slice').forEach((s) => s.classList.remove('dim'));
    cv.textContent = tot;
    cl.textContent = unit;
  };
  host.querySelectorAll('.slice').forEach((s) => {
    const k = s.dataset.k,
      vv = data.find((x) => x[0] === k)[1];
    bind(tipEl, s, `<b>${k}</b><br>${vv} ${unit} · ${Math.round((vv / tot) * 100)}%`);
    s.addEventListener('mouseenter', () => focus(k));
    s.addEventListener('mouseleave', reset);
  });
  host.querySelectorAll('.legend div').forEach((dv) => {
    const k = dv.dataset.k;
    dv.addEventListener('mouseenter', () => focus(k));
    dv.addEventListener('mouseleave', reset);
  });
}

export function renderHbars(host, data, total, unit, tipEl) {
  if (!data.length) {
    host.innerHTML = '<p class="help">Sin datos en este filtro.</p>';
    return;
  }
  const mx = data[0][1];
  host.innerHTML = data
    .map(([k], i) => `<div class="hbar"><div class="nm" title="${esc(k)}">${esc(k)}</div><div class="tr"><div class="fl" style="background:${PAL[i % PAL.length]}"></div></div><div class="vv">${data[i][1]}</div></div>`)
    .join('');
  requestAnimationFrame(() =>
    host.querySelectorAll('.hbar').forEach((h, i) => {
      h.querySelector('.fl').style.width = (data[i][1] / mx) * 100 + '%';
      bind(tipEl, h, `<b>${data[i][0]}</b><br>${data[i][1]} ${unit} · ${Math.round((data[i][1] / (total || 1)) * 100)}% del periodo`);
    })
  );
}

export function renderHeat(host, R, turnos, tipEl) {
  const ubis = tally(R, (r) => r.ubicacion)
    .slice(0, 6)
    .map((x) => x[0]);
  if (!ubis.length) {
    host.innerHTML = '<p class="help">Sin datos en este filtro.</p>';
    return;
  }
  const m = {};
  R.forEach((r) => {
    const k = r.ubicacion + '|' + r.turno;
    m[k] = (m[k] || 0) + 1;
  });
  const mx = Math.max(...Object.values(m), 1);
  let h = `<div class="heat" style="grid-template-columns:auto repeat(${turnos.length},1fr)"><div></div>${turnos.map((t) => `<div class="hh">Turno ${t}</div>`).join('')}`;
  ubis.forEach((u) => {
    h += `<div class="rl" title="${esc(u)}">${esc(u)}</div>`;
    turnos.forEach((t) => {
      const val = m[u + '|' + t] || 0,
        o = 0.14 + (val / mx) * 0.86;
      h += `<div class="cell" data-u="${esc(u)}" data-t="${t}" data-v="${val}" style="background:rgba(13,59,102,${o.toFixed(2)})">${val}</div>`;
    });
  });
  h += '</div>';
  host.innerHTML = h;
  host.querySelectorAll('.cell').forEach((c) => bind(tipEl, c, `<b>${c.dataset.u} · Turno ${c.dataset.t}</b><br>${c.dataset.v} reportes`));
}
