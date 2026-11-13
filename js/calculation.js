'use strict';
const referenceCache = new Map();
function reference(p, a, b) {
  let key = p.key + '|' + a + '|' + b; if (referenceCache.has(key)) return referenceCache.get(key); let preset = catalog.find(q => q.key === p.key), improper = preset?.expr === '1/sqrt(1-x^2)' && a >= -1 && b <= 1 && (a === -1 || b === 1); let result;
  if (improper) { let v = Math.asin(b) - Math.asin(a); result = { value: v, type: 'Analítica por limite (imprópria)', error: 0, area: v, areaError: 0, note: 'Integral imprópria convergente. As extremidades singulares não podem ser amostradas. Use ponto médio; não há retângulo finito no extremo.' }; }
  else if (preset?.expr === 'floor(x)') { let F = x => { let k = Math.floor(x); return k * x - k * (k + 1) / 2; }, v = F(b) - F(a), g = a >= 0 ? v : b <= 0 ? -v : F(a) + F(b); result = { value: v, type: 'Analítica · soma dos degraus', error: 0, area: g, areaError: 0, note: 'Função descontínua integrável: integração exata dos degraus. As amostras nas bordas dependem do método.' }; }
  else { MathLab.certify(p.ast, a, b); let q = MathLab.quadrature(p.fn, a, b), g = MathLab.quadrature(x => Math.abs(p.fn(x)), a, b); let exact = preset?.primitive ? preset.primitive(b) - preset.primitive(a) : null; if (!q.ok && !Number.isFinite(exact)) throw Error('Quadratura não atingiu a tolerância. Referência indisponível; reduza o intervalo.'); if (!g.ok) throw Error('Área geométrica não atingiu a tolerância; reduza o intervalo.'); result = { value: Number.isFinite(exact) ? exact : q.value, type: Number.isFinite(exact) ? 'Analítica · primitiva conhecida' : 'Numérica · Simpson adaptativo', error: Number.isFinite(exact) ? 0 : q.error, area: g.value, areaError: g.error, note: 'Domínio verificado por intervalos. Quadratura com tolerância absoluta alvo 10⁻⁹; estimativa de erro não é uma garantia rigorosa.' }; }
  referenceCache.set(key, result); if (referenceCache.size > 30) referenceCache.delete(referenceCache.keys().next().value); return result;
}

const convergenceCounts = [1, 2, 3, 4, 6, 8, 10, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 500];
function calculate({ expression, a, b, n, method, convergence }) {
  const result = { ref: null, model: null, error: '', comparison: {}, series: null };
  try {
    if (!Number.isInteger(n) || n < 1 || n > 500) throw Error('Use entre 1 e 500 subdivisões.');
    const parsed = MathLab.parse(expression);
    const low = Math.min(a, b), high = Math.max(a, b);
    if (parsed.key === MathLab.parse('1/x').key && low <= 0 && high >= 0) {
      throw Error('A integral imprópria usual de 1/x diverge neste intervalo.');
    }
    const base = reference(parsed, low, high);
    result.ref = { ...base, value: a > b ? -base.value : base.value };
    function sample(count, rule) {
      return MathLab.approximate(parsed.fn, a, b, count, rule);
    }
    try { result.model = sample(n, method); } catch (error) { result.error = error.message; }
    function sum(count, rule) {
      try { return sample(count, rule).sum; } catch { return undefined; }
    }
    for (const rule of Object.keys(methods)) {
      result.comparison[rule] = rule === method ? result.model?.sum : sum(n, rule);
    }
    if (convergence) {
      result.series = Object.keys(methods).map(rule =>
        convergenceCounts.map(count => ({ n: count, y: sum(count, rule) })));
    }
  } catch (error) { result.error = error.message; }
  return result;
}
