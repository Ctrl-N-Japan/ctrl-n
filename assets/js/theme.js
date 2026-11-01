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
    document.querySelectorAll('input[name="theme"]').forEach(input => {
      input.checked = input.value === preference;
    });
  }

  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="theme"]').forEach(input => {
      input.disabled = false;
      input.addEventListener('change', () => {
        if (!input.checked || !valid(input.value)) return;
        preference = input.value;
        apply();
        try { localStorage.setItem(key, preference); } catch { /* Session only. */ }
      });
    });
    apply();
  });
})();
