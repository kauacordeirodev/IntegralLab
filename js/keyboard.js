(() => {
  const panel = document.getElementById('keyboardPanel');
  const toggle = document.getElementById('keyboardToggle');
  const keys = document.getElementById('mathKeys');
  const tabs = document.querySelectorAll('[data-keys]');
  const fieldNames = { expression: 'f(x)', a: 'limite a', b: 'limite b', second: 'g(x)', n: 'subdivisões' };
  let field = document.getElementById('expression');
  const groups = {
    numbers: [
      ['x'], ['π'], ['e'], ['('], ['7'], ['8'], ['9'], ['÷', '/'],
      ['x²', '^2'], ['xⁿ', '^'], ['√', 'sqrt(', ')'], [')'], ['4'], ['5'], ['6'], ['×', '*'],
      ['sen', 'sin(', ')'], ['cos', 'cos(', ')'], ['ln', 'ln(', ')'], ['|x|', 'abs(', ')'], ['1'], ['2'], ['3'], ['−', '-'],
      ['←', null, 'left'], ['→', null, 'right'], ['⌫', null, 'erase'], ['↵', null, 'apply'], ['0'], ['.'], ['+'], ['fração', '/']
    ],
    functions: [
      ['sen', 'sin(', ')'], ['cos', 'cos(', ')'], ['tan', 'tan(', ')'], ['√', 'sqrt(', ')'],
      ['ln', 'ln(', ')'], ['log', 'log(', ')'], ['exp', 'exp(', ')'], ['|x|', 'abs(', ')'],
      ['arcsen', 'asin(', ')'], ['arccos', 'acos(', ')'], ['arctan', 'atan(', ')'], ['sinc', 'sinc(', ')'],
      ['piso', 'floor(', ')'], ['teto', 'ceil(', ')'], ['⌫', null, 'erase'], ['↵', null, 'apply']
    ]
  };
  const actionLabels = { left: 'Mover cursor à esquerda', right: 'Mover cursor à direita', erase: 'Apagar', apply: 'Aplicar' };
  for (const [id, name] of Object.entries(fieldNames)) {
    document.getElementById(id).addEventListener('focus', event => {
      field = event.currentTarget;
      document.getElementById('keyboardTarget').textContent = 'Editando ' + name;
    });
  }
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    toggle.lastElementChild.textContent = panel.hidden ? '⌃' : '⌄';
  });
  function edit(label, insertion, suffix) {
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    if (insertion === null && suffix === 'apply') {
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (insertion === null && suffix !== 'erase') {
      const cursor = suffix === 'left' ? Math.max(0, start - 1) : Math.min(field.value.length, end + 1);
      if (field.type !== 'number') field.setSelectionRange(cursor, cursor);
      return;
    }
    const selected = field.value.slice(start, end);
    const token = insertion === null ? '' : (insertion ?? label) + (suffix ? selected + suffix : '');
    const from = insertion === null && start === end ? Math.max(0, start - 1) : start;
    field.value = field.value.slice(0, from) + token + field.value.slice(end);
    if (field.type !== 'number') {
      const cursor = from + token.length - (suffix && insertion !== null && !selected ? suffix.length : 0);
      field.setSelectionRange(cursor, cursor);
    }
    field.dispatchEvent(new Event(field.type === 'number' || field.id === 'second' ? 'change' : 'input', { bubbles: true }));
  }
  function render(group) {
    keys.replaceChildren();
    for (const [label, insertion, suffix] of groups[group]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (insertion === null) {
        button.dataset.action = suffix;
        button.setAttribute('aria-label', actionLabels[suffix]);
      }
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => edit(label, insertion, suffix));
      keys.append(button);
    }
  }
  for (const tab of tabs) tab.addEventListener('click', () => {
    for (const other of tabs) other.setAttribute('aria-pressed', String(other === tab));
    render(tab.dataset.keys);
  });
  render('numbers');
})();

if (matchMedia('(max-width:760px)').matches) {
  document.getElementById('controlsPanel').open = false;
  document.getElementById('keyboardToggle').click();
}
