// Enhancements only. Every page reads and navigates the same without this file.
(() => {
  // The appearance button stays hidden unless the kit's script can fill its popover.
  const pop = document.getElementById('appearance-pop');
  if (pop && window.Xxd && window.Xxd.mountAppearance) {
    window.Xxd.mountAppearance(pop);
    document.querySelector('.xxd-appearance-btn').hidden = false;
  }

  const form = document.querySelector('[data-filter]');
  const list = document.querySelector('[data-filter-list]');
  if (!form || !list) return;
  const count = document.querySelector('[data-filter-count]');
  const empty = document.querySelector('[data-filter-empty]');
  const reset = document.querySelector('[data-filter-reset]');
  const normalize = (s) => s.normalize('NFKC').toLowerCase();
  const items = [...list.children].map((el) => ({ el, text: normalize(el.dataset.search || el.textContent) }));
  const fields = ['q', 'topic', 'grade', 'direction'];
  const selects = fields.filter((name) => form.elements[name].tagName === 'SELECT');

  const apply = () => {
    const words = normalize(form.elements.q.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const { el, text } of items) {
      const match =
        selects.every((name) => !form.elements[name].value || el.dataset[name] === form.elements[name].value) &&
        words.every((w) => text.includes(w));
      el.hidden = !match;
      if (match) shown++;
    }
    count.textContent = count.dataset.filterCount.replace('{shown}', shown).replace('{total}', items.length);
    empty.hidden = shown > 0;
    reset.hidden = !fields.some((name) => form.elements[name].value);

    const params = new URLSearchParams();
    for (const name of fields) if (form.elements[name].value) params.set(name, form.elements[name].value.trim());
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  };

  const initial = new URLSearchParams(location.search);
  for (const name of fields) {
    const value = initial.get(name);
    const field = form.elements[name];
    if (value === null) continue;
    if (field.tagName === 'SELECT' && ![...field.options].some((o) => o.value === value)) continue;
    field.value = value;
  }
  form.addEventListener('input', apply);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(apply));
  form.hidden = false;
  apply();
})();
