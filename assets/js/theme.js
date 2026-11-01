'use strict';

// Run before the stylesheet to apply the saved theme before first paint.
(() => {
  const key = 'ctrl-n-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) preference = saved;
  } catch { /* Theme switching still works when storage is unavailable. */ }

  function apply() {
    root.dataset.theme = preference === 'system'
      ? (system.matches ? 'dark' : 'light') : preference;
    const select = document.querySelector('#theme-select');
    if (select) select.value = preference;
  }

  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('#theme-select');
    if (!select) return;
    select.value = preference;
    select.disabled = false;
    select.addEventListener('change', () => {
      if (!valid(select.value)) return;
      preference = select.value;
      apply();
      try { localStorage.setItem(key, preference); } catch { /* Session only. */ }
    });
  });
})();
