'use strict';
const $ = id => document.getElementById(id), fmt = x => !Number.isFinite(x) ? '—' : Math.abs(x) > 1e7 || (Math.abs(x) > 0 && Math.abs(x) < 1e-6) ? x.toExponential(5).replace('.', ',') : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(Math.abs(x) < 1e-14 ? 0 : x);
const state = { a: 0, b: 3, n: 10, method: 'left', parsed: null, model: null, ref: null, area: null, view: null, page: 0, tab: 'compare', timer: null, cache: new Map(), error: '', highlight: 1 };
const colors = ['#73a8ff', '#ffa878', '#60d6bd', '#ce9bfa', '#f2ce66'];
function mathMarkup(t) { if (t.op === 'num') return '<mn>' + (t.label === 'pi' ? 'π' : t.label || t.v) + '</mn>'; if (t.op === 'x') return '<mi>x</mi>'; let a = mathMarkup(t.a); if (t.op === 'neg') return '<mrow><mo>−</mo><mo>(</mo>' + a + '<mo>)</mo></mrow>'; if (t.op === '^') return '<msup><mrow><mo>(</mo>' + a + '<mo>)</mo></mrow><mrow>' + mathMarkup(t.b) + '</mrow></msup>'; if (t.op === '/') return '<mfrac><mrow>' + a + '</mrow><mrow>' + mathMarkup(t.b) + '</mrow></mfrac>'; if (t.b) return '<mrow><mo>(</mo>' + a + '<mo>' + ({ '*': '·', '-': '−' }[t.op] || t.op) + '</mo>' + mathMarkup(t.b) + '<mo>)</mo></mrow>'; return '<mrow><mi>' + t.op + '</mi><mo>(</mo>' + a + '<mo>)</mo></mrow>'; }
function readLimit(s) { if (!s.trim()) throw Error('Preencha os limites.'); let p = MathLab.parse(s); if (/\bx\b/.test(s)) throw Error('Limites não podem conter x.'); let v = p.fn(0); if (!Number.isFinite(v) || Math.abs(v) > 1e6) throw Error('Use limites finitos entre −10⁶ e 10⁶.'); return v; }
function populate(filter = '') { let select = $('library'); select.replaceChildren(); let placeholder = document.createElement('option'); placeholder.textContent = 'Escolha um exemplo…'; placeholder.value = ''; select.append(placeholder); for (let category of [...new Set(catalog.map(x => x.category))]) { let group = document.createElement('optgroup'); group.label = category; for (let q of catalog.filter(q => q.category === category && [q.expr, q.category, q.description].join(' ').toLowerCase().includes(filter.toLowerCase()))) { let o = document.createElement('option'); o.value = q.id; o.textContent = q.expr + ' · ' + q.description; group.append(o); } if (group.children.length) select.append(group); } }
function selectPreset(id) { stop(); let p = catalog[id]; $('expression').value = p.expr; $('a').value = p.a; $('b').value = p.b; $('library').value = id; update(true); }
let revision = 0;
let pending = null;
let busy = false;
let worker = null;
let renderFrame = 0;
if (location.protocol !== 'file:' && typeof Worker !== 'undefined') {
  try {
    worker = new Worker('./js/worker.js');
    worker.onmessage = ({ data }) => receive(data);
    worker.onerror = event => {
      event.preventDefault();
      worker.terminate();
      worker = null;
      busy = false;
      update();
    };
  } catch { worker = null; }
}
function dispatch() {
  if (busy || !pending) return;
  const task = pending;
  pending = null;
  busy = true;
  if (worker) worker.postMessage(task);
  else receive({ id: task.id, result: calculate(task) });
}
function receive({ id, result }) {
  busy = false;
  if (id === revision) {
    Object.assign(state, result, { loading: false });
    state.highlight = Math.max(1, Math.min(Number($('highlight').value) || 1, state.model?.rows.length || 1));
    $('highlight').value = state.highlight;
    $('highlight').max = state.model?.rows.length || 1;
    refresh();
  }
  dispatch();
}
function refresh() {
  renderResults();
  explain();
  renderTab();
  if (!renderFrame) renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    draw();
  });
}
function update(fit = false) {
  const id = ++revision;
  pending = null;
  Object.assign(state, { loading: false, error: '', model: null, ref: null, parsed: null, comparison: {}, series: null, page: 0 });
  try {
    state.parsed = MathLab.parse($('expression').value);
    $('expression').removeAttribute('aria-invalid');
  } catch (error) {
    $('expression').setAttribute('aria-invalid', 'true');
    state.error = error.message;
    refresh();
    return;
  }
  try {
    state.a = readLimit($('a').value);
    state.b = readLimit($('b').value);
    if (Math.abs(state.b - state.a) < 1e-10) throw Error('Escolha limites distintos, separados por pelo menos 10⁻¹⁰.');
    state.n = Number($('n').value);
    if (!Number.isInteger(state.n) || state.n < 1 || state.n > 500) throw Error('Use de 1 a 500 subdivisões.');
    $('range').value = state.n;
    state.method = $('method').value;
    const preset = catalog.find(item => item.key === state.parsed.key);
    $('presetInfo').textContent = preset ? preset.description + ' ' + preset.domain + ' ' + preset.experiment : '';
    if (fit || !state.view) fitView();
    state.loading = true;
    pending = { id, expression: $('expression').value, a: state.a, b: state.b, n: state.n, method: state.method, convergence: state.tab === 'convergence' };
  } catch (error) {
    state.error = error.message;
    state.parsed = null;
  }
  refresh();
  dispatch();
}
function renderResults() {
  const preview = $('integralPreview');
  if (state.parsed) {
    const lower = mathMarkup(MathLab.parse($('a').value).ast);
    const upper = mathMarkup(MathLab.parse($('b').value).ast);
    const integrand = mathMarkup(state.parsed.ast);
    preview.innerHTML = '<math display="block"><mrow><msubsup><mo>∫</mo><mrow>' + lower
      + '</mrow><mrow>' + upper + '</mrow></msubsup>' + integrand + '<mi mathvariant="normal">d</mi><mi>x</mi></mrow></math>';
  } else {
    preview.textContent = '∫ f(x) dx';
  }
  let { ref, model } = state; let valid = !!ref; let sum = valid ? model?.sum : NaN; $('sum').textContent = fmt(sum); $('reference').textContent = fmt(ref?.value); $('geometric').textContent = fmt(ref?.area); $('areaLabel').textContent = ref ? '∫ |f(x)| dx · ' + (ref.type.includes('imprópria') ? 'analítica por limite' : ref.type.includes('degraus') ? 'analítica por degraus' : 'numérica, erro est. ' + fmt(ref.areaError)) : 'Referência indisponível'; $('refLabel').textContent = ref ? ref.type + (ref.type.startsWith('Numérica') ? ' · erro est. ' + fmt(ref.error) : ' · avaliação em ponto flutuante') : 'Não certificada'; $('methodLabel').textContent = methods[state.method][0]; let err = Math.abs(sum - ref?.value); $('error').textContent = fmt(err); $('relative').textContent = ref && Math.abs(ref.value) > Math.max(1e-12, 10 * ref.error) ? 'Relativo: ' + fmt(err / Math.abs(ref.value) * 100) + '%' : 'Relativo: não adequado perto de zero'; $('delta').textContent = 'Δx = (b − a)/n = (' + fmt(state.b) + ' − ' + fmt(state.a) + ')/' + state.n + ' = ' + fmt((state.b - state.a) / state.n); $('subtitle').textContent = methods[state.method][0] + ' · n = ' + state.n + ' · [' + fmt(state.a) + ', ' + fmt(state.b) + ']'; $('status').textContent = state.error || (state.loading ? 'Calculando…' : ref?.note || 'Verifique os parâmetros.'); $('status').classList.toggle('warning', state.loading || !!state.error || Boolean(ref?.type.includes('imprópria'))); $('graph').setAttribute('aria-label', 'Gráfico de ' + $('expression').value + ', ' + $('subtitle').textContent); $('printInfo').textContent = 'f(x)=' + $('expression').value + '; ' + $('subtitle').textContent;
}
function explain() { let dx = (state.b - state.a) / state.n; $('formula').textContent = methods[state.method][1]; $('explanation').textContent = 'Dividimos o intervalo de ' + fmt(state.a) + ' até ' + fmt(state.b) + (state.a > state.b ? ' (da direita para a esquerda)' : '') + ' em ' + state.n + ' partes iguais. Cada parte tem largura ' + fmt(Math.abs(dx)) + '. Pelo método ' + methods[state.method][0] + ', ' + methods[state.method][2] + '. Somamos as contribuições com sinal para aproximar a integral.'; let row = state.model?.rows[state.highlight - 1]; $('individual').textContent = row ? 'Figura ' + state.highlight + ': [' + fmt(row.x0) + ', ' + fmt(row.x1) + ']; largura ' + fmt(Math.abs(row.x1 - row.x0)) + '; ' + (row.ys.length === 1 ? 'altura f(x*) = ' : 'alturas = ') + row.ys.map(fmt).join('; ') + '; contribuição = ' + fmt(row.contribution) + '.' : ''; $('partial').textContent = $('build').checked && state.ref && state.model ? 'Soma parcial de ' + state.highlight + ' figura(s): ' + fmt(state.model.rows.slice(0, state.highlight).reduce((s, r) => s + r.contribution, 0)) : ''; }
function renderTab() {
  if (state.tab === 'compare') { let html = '<table><thead><tr><th>Método</th><th>Aproximação</th><th>Erro absoluto</th><th>Erro relativo</th></tr></thead><tbody>'; for (let m of Object.keys(methods)) { let q = Number.isFinite(state.comparison?.[m]) ? { sum: state.comparison[m] } : null, err = q ? Math.abs(q.sum - state.ref.value) : NaN; html += '<tr><td>' + methods[m][0] + '</td><td>' + fmt(q?.sum) + '</td><td>' + fmt(err) + '</td><td>' + (state.ref && Math.abs(state.ref.value) > 1e-12 ? fmt(err / Math.abs(state.ref.value) * 100) + '%' : '—') + '</td></tr>'; } $('comparison').innerHTML = html + '</tbody></table>'; }
  if (state.tab === 'table') renderTable(); if (state.tab === 'convergence') drawConvergence();
}
function renderTable() { let rows = state.ref ? state.model?.rows || [] : [], pages = Math.max(1, Math.ceil(rows.length / 15)); state.page = Math.max(0, Math.min(state.page, pages - 1)); $('page').textContent = (state.page + 1) + ' / ' + pages; $('prevPage').disabled = state.page === 0; $('nextPage').disabled = state.page === pages - 1; let html = '<table><thead><tr><th>i</th><th>Intervalo</th><th>x*</th><th>Altura(s)</th><th>Δx</th><th>Contribuição</th></tr></thead><tbody>'; for (let r of rows.slice(state.page * 15, state.page * 15 + 15)) html += '<tr>' + [r.i, '[' + fmt(r.x0) + '; ' + fmt(r.x1) + ']', fmt(r.xs), r.ys.map(fmt).join(' / '), fmt(r.dx), fmt(r.contribution)].map(x => '<td>' + x + '</td>').join('') + '</tr>'; $('tableData').innerHTML = html + '</tbody></table>'; }
function fitView() { if (!state.parsed) { state.view = null; return; } let a = Math.min(state.a, state.b), b = Math.max(state.a, state.b); if (!Number.isFinite(a + b) || b <= a) return; let ys = [0]; for (let i = 0; i <= 600; i++) { let y = state.parsed.fn(a + (b - a) * i / 600); if (Number.isFinite(y)) ys.push(y); } ys.sort((a, b) => a - b); let lo = ys[Math.floor(ys.length * .02)], hi = ys[Math.floor((ys.length - 1) * .98)]; lo = Math.min(0, lo); hi = Math.max(0, hi); let gap = hi - lo || 2; state.view = { xmin: a - (b - a) * .15, xmax: b + (b - a) * .15, ymin: lo - gap * .17, ymax: hi + gap * .17 }; }
function setup(canvas) { let box = canvas.getBoundingClientRect(), w = Math.max(100, box.width), h = Math.max(100, box.height), d = Math.min(devicePixelRatio || 1, 2); canvas.width = w * d; canvas.height = h * d; let c = canvas.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return { c, w, h }; }
const nice = x => { let p = 10 ** Math.floor(Math.log10(x)), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
function draw() {
  let { c, w, h } = setup($('graph')), css = getComputedStyle(document.body), text = css.getPropertyValue('--muted'), line = css.getPropertyValue('--line'), cyan = css.getPropertyValue('--cyan'); c.fillStyle = css.getPropertyValue('--input'); c.fillRect(0, 0, w, h); if (!state.view || !state.parsed) return; let v = state.view, L = 58, R = w - 18, T = 24, B = h - 39, sx = x => L + (x - v.xmin) / (v.xmax - v.xmin) * (R - L), sy = y => B - (y - v.ymin) / (v.ymax - v.ymin) * (B - T); state.screen = { L, R, T, B, w, h, sx, sy }; let xs = nice((v.xmax - v.xmin) / 7), ys = nice((v.ymax - v.ymin) / 6); if ($('grid').checked) {
    c.beginPath();
    c.strokeStyle = '#eff0f4';
    for (let i = Math.ceil(v.xmin / (xs / 5)), end = Math.floor(v.xmax / (xs / 5)), count = 0; i <= end && count < 150; i++, count++) {
      const x = sx(i * (xs / 5));
      c.moveTo(x, T); c.lineTo(x, B);
    }
    for (let i = Math.ceil(v.ymin / (ys / 5)), end = Math.floor(v.ymax / (ys / 5)), count = 0; i <= end && count < 150; i++, count++) {
      const y = sy(i * (ys / 5));
      c.moveTo(L, y); c.lineTo(R, y);
    }
    c.stroke();
  }
  c.font = '11px system-ui'; c.fillStyle = text; c.textAlign = 'center'; for (let i = 0, x = Math.ceil(v.xmin / xs) * xs; x <= v.xmax && i < 30; x += xs, i++) { c.fillText(fmt(x), sx(x), h - 15); if ($('grid').checked) { c.strokeStyle = line; c.beginPath(); c.moveTo(sx(x), T); c.lineTo(sx(x), B); c.stroke(); } } c.textAlign = 'right'; for (let i = 0, y = Math.ceil(v.ymin / ys) * ys; y <= v.ymax && i < 30; y += ys, i++) { c.fillText(fmt(y), L - 8, sy(y) + 4); if ($('grid').checked) { c.strokeStyle = line; c.beginPath(); c.moveTo(L, sy(y)); c.lineTo(R, sy(y)); c.stroke(); } } c.save(); c.beginPath(); c.rect(L, T, R - L, B - T); c.clip(); const poly = (pts, color, stroke = false) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(sx(p[0]), sy(p[1])) : c.moveTo(sx(p[0]), sy(p[1]))); c.closePath(); c.fillStyle = color; c.fill(); if (stroke) c.stroke(); };
  // Fine strips split at zero: sign colors remain correct for trapezoids and quadratics.
  function strip(x0, y0, x1, y1, alpha) { if (!Number.isFinite(y0 + y1) || Math.abs(sy(y1) - sy(y0)) > h * 2) return; let fill = (a, u, b, v, pos) => poly([[a, 0], [a, u], [b, v], [b, 0]], pos ? 'rgba(91,156,255,' + alpha + ')' : 'rgba(255,115,145,' + alpha + ')'); if (y0 * y1 < 0) { let z = x0 + (x1 - x0) * (-y0) / (y1 - y0); fill(x0, y0, z, 0, y0 >= 0); fill(z, 0, x1, y1, y1 >= 0); } else fill(x0, y0, x1, y1, y0 + y1 >= 0); }
  const continuous = (p, x0, x1, y0, y1) => { if (!Number.isFinite(y0 + y1)) return false; try { MathLab.interval(p.ast, Math.min(x0, x1), Math.max(x0, x1)); } catch { return false; } let mid = p.fn((x0 + x1) / 2); return Number.isFinite(mid) && Math.abs(sy(y1) - sy(y0)) < h * .75 && Math.abs(mid - (y0 + y1) / 2) < Math.max(1e-8, (v.ymax - v.ymin) * .12); };
  if ($('area').checked && state.ref) { for (let i = 0; i < 800; i++) { let x0 = state.a + (state.b - state.a) * i / 800, x1 = state.a + (state.b - state.a) * (i + 1) / 800, y0 = state.parsed.fn(x0), y1 = state.parsed.fn(x1); if (continuous(state.parsed, x0, x1, y0, y1)) strip(x0, y0, x1, y1, .15); } }
  if ($('shapes').checked && state.model && state.ref) { let rows = state.model.rows; for (let [j, r] of rows.entries()) { if ($('build').checked && j >= state.highlight) break; let selected = j === state.highlight - 1; c.strokeStyle = selected ? '#f5ce70' : r.contribution * (state.b - state.a) >= 0 ? '#7baaff' : '#ff91a3'; c.lineWidth = selected ? 2.5 : 1; let points; if (r.ys.length === 1) { points = [[r.x0, r.ys[0]], [r.x1, r.ys[0]]]; strip(r.x0, r.ys[0], r.x1, r.ys[0], selected ? .43 : .25); } else if (r.ys.length === 2) { points = [[r.x0, r.ys[0]], [r.x1, r.ys[1]]]; strip(r.x0, r.ys[0], r.x1, r.ys[1], selected ? .43 : .25); } else { points = []; for (let k = 0; k <= 24; k++) { let t = k / 24 * 2, y = r.ys[0] * (t - 1) * (t - 2) / 2 - r.ys[1] * t * (t - 2) + r.ys[2] * t * (t - 1) / 2; points.push([r.x0 + k / 24 * (r.x1 - r.x0), y]); if (k) strip(points[k - 1][0], points[k - 1][1], points[k][0], y, selected ? .43 : .25); } } c.beginPath(); c.moveTo(sx(r.x0), sy(0)); for (let p of points) c.lineTo(sx(p[0]), sy(p[1])); c.lineTo(sx(r.x1), sy(0)); c.stroke(); if ($('points').checked) { let dots = r.ys.length === 1 ? [[r.xs, r.ys[0]]] : r.ys.length === 2 ? points : [[r.x0, r.ys[0]], [r.xs, r.ys[1]], [r.x1, r.ys[2]]]; for (let p of dots) { c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(sx(p[0]), sy(p[1]), state.n > 100 ? 1.5 : 3, 0, 2 * Math.PI); c.fill(); } } } }
  c.strokeStyle = text; c.lineWidth = 1.2; c.beginPath(); c.moveTo(L, sy(0)); c.lineTo(R, sy(0)); c.moveTo(sx(0), T); c.lineTo(sx(0), B); c.stroke(); c.setLineDash([5, 5]); for (let x of [state.a, state.b]) { c.beginPath(); c.moveTo(sx(x), T); c.lineTo(sx(x), B); c.stroke(); } c.setLineDash([]);
  function hasJump(t, a, b) { if (['floor', 'ceil'].includes(t.op) && MathLab.value(t, a) !== MathLab.value(t, b)) return true; return !!((t.a && hasJump(t.a, a, b)) || (t.b && hasJump(t.b, a, b))); }
  function curve(p, color) { c.strokeStyle = color; c.lineWidth = 2.5; c.beginPath(); let prev = null; for (let i = 0; i <= 1000; i++) { let x = v.xmin + (v.xmax - v.xmin) * i / 1000, y = p.fn(x); if (!Number.isFinite(y)) { prev = null; continue; } if (prev && continuous(p, prev.x, x, prev.y, y) && !hasJump(p.ast, prev.x, x)) c.lineTo(sx(x), sy(y)); else c.moveTo(sx(x), sy(y)); prev = { x, y }; } c.stroke(); }
  if ($('curve').checked) curve(state.parsed, cyan); $('secondError').textContent = ''; if ($('showSecond').checked) { try { curve(MathLab.parse($('second').value), '#ce9bfa'); } catch (e) { $('secondError').textContent = e.message; } } c.restore(); c.fillStyle = text; c.textAlign = 'left'; c.fillText('a = ' + fmt(state.a), Math.max(L, Math.min(R - 70, sx(state.a) + 4)), 15); c.textAlign = 'right'; c.fillText('b = ' + fmt(state.b), Math.min(R, Math.max(L + 70, sx(state.b) - 4)), 15); c.fillText('x', w - 5, h - 15); c.textAlign = 'left'; c.fillText('f(x)', 5, 15);
}
function drawConvergence() { if (state.tab !== 'convergence') return; let { c, w, h } = setup($('conv')), css = getComputedStyle(document.body); c.fillStyle = css.getPropertyValue('--input'); c.fillRect(0, 0, w, h); if (!state.ref || !state.parsed) { $('convLegend').textContent = 'Referência indisponível neste intervalo.'; return; } const data = state.series; if (!data) return; let all = data.flat().map(p => p.y).filter(Number.isFinite); all.push(state.ref.value); let low = Math.min(...all), high = Math.max(...all), pad = (high - low) * .1 || .1; low -= pad; high += pad; let sx = x => 65 + (w - 85) * (x - 1) / 499, sy = y => h - 35 - (h - 60) * (y - low) / (high - low); c.strokeStyle = css.getPropertyValue('--muted'); c.fillStyle = c.strokeStyle; c.font = '11px system-ui'; c.beginPath(); c.moveTo(65, 20); c.lineTo(65, h - 35); c.lineTo(w - 15, h - 35); c.stroke(); for (let n of [1, 100, 250, 500]) c.fillText(n, sx(n) - 7, h - 15); c.fillText('n', w - 12, h - 15); for (let i = 0; i <= 4; i++) { let y = low + (high - low) * i / 4; c.fillText(fmt(y), 2, sy(y)); } c.setLineDash([4, 4]); c.beginPath(); c.moveTo(65, sy(state.ref.value)); c.lineTo(w - 15, sy(state.ref.value)); c.stroke(); c.setLineDash([]); data.forEach((series, i) => { c.strokeStyle = colors[i]; c.lineWidth = 1.8; c.beginPath(); let active = false; for (let p of series) { if (!Number.isFinite(p.y)) continue; if (active) c.lineTo(sx(p.n), sy(p.y)); else c.moveTo(sx(p.n), sy(p.y)); active = true; } c.stroke(); for (let p of series) if (Number.isFinite(p.y)) { c.fillStyle = colors[i]; c.beginPath(); c.arc(sx(p.n), sy(p.y), 2.3, 0, 7); c.fill(); } }); $('convLegend').replaceChildren(); Object.values(methods).forEach((m, i) => { let el = document.createElement('span'); el.style.color = colors[i]; el.textContent = '● ' + m[0] + '  '; $('convLegend').append(el); }); $('convLegend').append(' · tracejado: referência'); }
function stop() { clearTimeout(state.timer); state.timer = null; $('animate').textContent = '▶ Refinar'; $('animate').setAttribute('aria-pressed', 'false'); }
function setN(n) { $('n').value = Math.max(1, Math.min(500, n)); update(); }
function tick() { let step = state.method === 'simpson' ? 2 : 1; if (state.n >= 500) { stop(); return; } setN(state.n + step); state.timer = setTimeout(tick, Number($('speed').value)); }
function zoom(k) { if (!state.view) return; let v = state.view, cx = (v.xmin + v.xmax) / 2, cy = (v.ymin + v.ymax) / 2, dx = (v.xmax - v.xmin) * k / 2, dy = (v.ymax - v.ymin) * k / 2; if (dx < 1e-12 || dx > 1e9 || dy < 1e-14 || !Number.isFinite(dy)) return; state.view = { xmin: cx - dx, xmax: cx + dx, ymin: cy - dy, ymax: cy + dy }; draw(); }
$('search').oninput = () => populate($('search').value); $('library').onchange = () => { if ($('library').value !== '') selectPreset(+$('library').value); };
for (let id of ['expression', 'a', 'b']) $(id).onchange = () => { stop(); update(true); }; $('expression').onkeydown = e => { if (e.key === 'Enter') update(true); }; for (let id of ['expression', 'a', 'b']) $(id).oninput = () => { stop(); update(true); };
$('n').onchange = () => { stop(); update(); }; $('method').onchange = () => { stop(); update(); }; $('range').oninput = () => { stop(); setN(+$('range').value); }; $('minus').onclick = () => { stop(); setN(state.n - (state.method === 'simpson' ? 2 : 1)); }; $('plus').onclick = () => { stop(); setN(state.n + (state.method === 'simpson' ? 2 : 1)); }; $('animate').onclick = () => { if (state.timer) { stop(); return; } if (!state.ref) return; if (state.method === 'simpson' && state.n % 2) setN(state.n + 1); if (state.n >= 500) setN(state.method === 'simpson' ? 2 : 1); $('animate').textContent = 'Ⅱ Pausar'; $('animate').setAttribute('aria-pressed', 'true'); state.timer = setTimeout(tick, Number($('speed').value)); }; $('restart').onclick = () => { stop(); setN(state.method === 'simpson' ? 2 : 1); }; $('reset').onclick = () => { stop(); $('method').value = 'left'; $('n').value = 10; $('highlight').value = 1; $('build').checked = false; $('showSecond').checked = false; $('expression').value = '2x^2'; $('a').value = '0'; $('b').value = '2'; $('library').value = ''; update(true); };
$('center').onclick = () => { fitView(); draw(); }; $('zoomIn').onclick = () => zoom(.8); $('zoomOut').onclick = () => zoom(1.25); for (let id of ['grid', 'curve', 'shapes', 'points', 'area', 'showSecond', 'second']) $(id).onchange = draw;
$('hide').onclick = () => { let on = document.body.classList.toggle('hidden-results'); $('hide').textContent = on ? 'Revelar resultados' : 'Ocultar resultados'; $('hide').setAttribute('aria-pressed', on); }; $('explain').onclick = () => { explain(); $('explanation').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }; $('highlight').onchange = () => { state.highlight = Math.max(1, Math.min(Number($('highlight').value) || 1, state.model?.rows.length || 1)); $('highlight').value = state.highlight; explain(); draw(); }; $('step').onclick = () => { $('build').checked = true; $('highlight').value = state.highlight >= (state.model?.rows.length || 1) ? 1 : state.highlight + 1; $('highlight').onchange(); }; $('build').onchange = () => { explain(); draw(); };
for (let b of document.querySelectorAll('[data-tab]')) b.onclick = () => { state.tab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); }); document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.id === state.tab)); if (state.tab === 'convergence' && !state.series) update(); else renderTab(); }; $('prevPage').onclick = () => { state.page--; renderTable(); }; $('nextPage').onclick = () => { state.page++; renderTable(); };
let drag = null; $('graph').onpointerdown = e => { if (!state.view) return; drag = { x: e.clientX, y: e.clientY, v: { ...state.view } }; $('graph').setPointerCapture(e.pointerId); }; $('graph').onpointerup = () => drag = null; $('graph').onpointercancel = () => drag = null; $('graph').onpointermove = e => { if (!state.screen || !state.view || !state.parsed) return; let s = state.screen, v = state.view, box = $('graph').getBoundingClientRect(); if (drag) { let dx = (e.clientX - drag.x) / (s.R - s.L) * (drag.v.xmax - drag.v.xmin), dy = (e.clientY - drag.y) / (s.B - s.T) * (drag.v.ymax - drag.v.ymin); state.view = { xmin: drag.v.xmin - dx, xmax: drag.v.xmax - dx, ymin: drag.v.ymin + dy, ymax: drag.v.ymax + dy }; draw(); } let x = v.xmin + (e.clientX - box.left - s.L) / (s.R - s.L) * (v.xmax - v.xmin), y = state.parsed.fn(x); $('hover').textContent = 'x = ' + fmt(x) + ' · f(x) = ' + fmt(y); }; $('graph').addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive: false }); $('graph').onkeydown = e => { if (!state.view) return; let v = state.view, dx = (v.xmax - v.xmin) * .1, dy = (v.ymax - v.ymin) * .1; if (e.key === '+' || e.key === '=') zoom(.8); else if (e.key === '-') zoom(1.25); else if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { let d = e.key === 'ArrowLeft' ? -dx : dx; v.xmin += d; v.xmax += d; draw(); } else if (['ArrowUp', 'ArrowDown'].includes(e.key)) { let d = e.key === 'ArrowUp' ? dy : -dy; v.ymin += d; v.ymax += d; draw(); } else return; e.preventDefault(); };
const experiments = [['Áreas que se cancelam', 0, 'Integral zero não significa ausência de área.', 'mid', 10], ['Primeira soma de Riemann', 1, 'Comece com quatro retângulos; compare as extremidades.', 'left', 4], ['Retas e trapézios', 4, 'Por que apenas um trapézio é suficiente?', 'trap', 1], ['Simpson e polinômios', 2, 'Parábolas integradas em pares reproduzem polinômios até grau 3.', 'simpson', 4], ['Seno e a referência 2', 10, 'Refine a partição de [0,π].', 'mid', 6], ['Crescimento exponencial', 17, 'Compare os cinco erros para o mesmo n.', 'trap', 10], ['Sem primitiva elementar', 19, 'Quadratura numérica permite estudar e^(x²).', 'simpson', 10], ['Integral imprópria', 32, 'Ponto médio evita amostrar as extremidades singulares.', 'mid', 20], ['Semicírculo e π', 27, 'A área do semicírculo é 2π.', 'trap', 20], ['Oscilações e erro', 16, 'Na aba Convergência, observe o efeito do refinamento.', 'left', 3], ['Valor absoluto', 28, 'A função |x| transforma as regiões negativas em positivas.', 'mid', 5], ['Degraus e amostragem', 35, 'Descontinuidades de salto ainda podem ser integráveis.', 'left', 8]];
for (let [title, id, desc, m, n] of experiments) { let d = document.createElement('div'); d.className = 'exercise'; let h = document.createElement('h3'); h.textContent = title; let p = document.createElement('p'); p.textContent = desc; let b = document.createElement('button'); b.textContent = 'Abrir experimento'; b.onclick = () => { $('method').value = m; $('n').value = n; selectPreset(id); $('graph').scrollIntoView({ block: 'center' }); }; d.append(h, p, b); $('experimentList').append(d); }
const exercises = [['Básico', 'Estime ∫₀² x dx com quatro retângulos à esquerda.', 'Δx=0,5. Alturas: 0; 0,5; 1; 1,5. Soma = 0,5×3 = 1,5. A integral é 2.'], ['Básico', 'Por que ∫₋₂² x dx = 0, mas a área total é 4?', 'O triângulo à esquerda contribui −2; o da direita, +2. A integral é −2+2=0. A área total é 2+2=4.'], ['Intermediário', 'Para x² em [0,3], a esquerda subestima ou superestima?', 'Subestima: x² é crescente nesse intervalo. Cada altura à esquerda fica abaixo da curva na sua subdivisão.'], ['Intermediário', 'Para x² em [0,3], n=2, qual é mais preciso: trapézios ou Simpson?', 'Trapézios = 10,125; erro 1,125. Simpson = 9; exato em aritmética ideal, pois integra exatamente polinômios de grau até 3.'], ['Avançado', 'Para x² em [0,3], qual o menor n no ponto médio com erro absoluto menor que 0,01?', 'O erro é 9/(4n²). Exigimos n²>225; n>15. Portanto n=16. Em n=15 o erro é 0,01, que não é estritamente menor.'], ['Avançado', 'Podemos afirmar que ∫₋₁¹ 1/x dx = 0 por simetria?', 'Não. Os limites impróprios dos dois lados não convergem separadamente. O valor principal de Cauchy é zero, mas não é a integral imprópria usual.']];
for (let [level, q, solution] of exercises) { let d = document.createElement('div'); d.className = 'exercise'; let h = document.createElement('h3'); h.textContent = level; let p = document.createElement('p'); p.textContent = q; let input = document.createElement('input'); input.placeholder = 'Sua resposta ou raciocínio'; input.setAttribute('aria-label', q); let b = document.createElement('button'); b.textContent = 'Revelar solução'; b.disabled = true; let answer = document.createElement('p'); answer.hidden = true; answer.textContent = solution; input.oninput = () => b.disabled = !input.value.trim(); b.onclick = () => answer.hidden = false; d.append(h, p, input, b, answer); $('exerciseList').append(d); }
function download(blob, name) { let a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('png').onclick = () => { draw(); let graph = $('graph'), out = document.createElement('canvas'); out.width = Math.max(1000, graph.width); let gh = Math.round(graph.height * out.width / graph.width); out.height = gh + 140; let c = out.getContext('2d'); c.fillStyle = getComputedStyle(document.body).getPropertyValue('--input'); c.fillRect(0, 0, out.width, out.height); c.drawImage(graph, 0, 0, out.width, gh); c.fillStyle = getComputedStyle(document.body).getPropertyValue('--text'); c.font = '18px system-ui'; c.fillText('IntegralLab 2.0 · f(x) = ' + $('expression').value, 20, gh + 28); c.fillText($('subtitle').textContent, 20, gh + 56); c.fillText('Azul: positivo · Rosa: negativo · Ciano: f(x) · Roxo: g(x)', 20, gh + 84); c.fillText(document.body.classList.contains('hidden-results') ? 'Resultados ocultos' : 'Aproximação: ' + $('sum').textContent + ' · Referência: ' + $('reference').textContent, 20, gh + 112); out.toBlob(blob => download(blob, 'integrallab_grafico.png')); };
$('csv').onclick = () => { if (!state.model || !state.ref) { $('exportInfo').textContent = 'Não há tabela validada para exportar.'; return; } let header = 'i;x_inicio;x_fim;x_amostra;alturas;delta_x;contribuicao\r\n', rows = state.model.rows.map(r => [r.i, r.x0, r.x1, r.xs, r.ys.join(' | '), r.dx, r.contribution].join(';')).join('\r\n'); download(new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' }), 'integrallab_tabela.csv'); };
$('print').onclick = () => window.print(); async function copy(text) { try { await navigator.clipboard.writeText(text); $('exportInfo').textContent = 'Copiado.'; $('copyFallback').hidden = true; } catch { $('copyFallback').hidden = false; $('copyFallback').value = text; $('copyFallback').select(); $('exportInfo').textContent = 'Copie o texto selecionado (Ctrl+C ou toque prolongado).'; } }
$('copy').onclick = () => copy('IntegralLab 2.0\nf(x) = ' + $('expression').value + '\n' + $('subtitle').textContent + '\nAproximação: ' + $('sum').textContent + '\nReferência: ' + $('reference').textContent + ' (' + $('refLabel').textContent + ')\nErro absoluto: ' + $('error').textContent + '\nÁrea geométrica: ' + $('geometric').textContent + '\n' + $('status').textContent);
$('share').onclick = () => { let config = { expression: $('expression').value, a: $('a').value, b: $('b').value, n: state.n, method: state.method, second: $('second').value, showSecond: $('showSecond').checked }; let hash = '#sim=' + encodeURIComponent(JSON.stringify(config)); history.replaceState(null, '', hash); copy(location.href); $('exportInfo').textContent = location.protocol === 'file:' ? 'Configuração no fragmento da URL. Em outro computador, abra este mesmo HTML e acrescente #sim=… à URL local.' : 'A configuração fica no fragmento da URL; não é enviada a um servidor.'; };
function loadHash() { if (!location.hash.startsWith('#sim=')) return; try { let q = JSON.parse(decodeURIComponent(location.hash.slice(5))); for (let id of ['expression', 'a', 'b', 'n', 'method', 'second']) if (typeof q[id] === 'string' || typeof q[id] === 'number') $(id).value = String(q[id]).slice(0, 200); if (!Object.hasOwn(methods, $('method').value)) $('method').value = 'left'; $('showSecond').checked = q.showSecond === true; } catch { $('exportInfo').textContent = 'Configuração da URL inválida; exemplo inicial mantido.'; } }
populate(); loadHash(); update(true); new ResizeObserver(() => { draw(); drawConvergence(); }).observe($('graph').parentElement); window.addEventListener('hashchange', () => { loadHash(); update(true); }); window.addEventListener('beforeprint', draw); window.addEventListener('afterprint', draw);
window.IntegralLab = { MathLab, catalog, state, update, reference };
