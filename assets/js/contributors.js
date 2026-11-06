'use strict';

// Read the saved snapshot; page views do not call the GitHub API.

(async (scriptUrl) => {
  const list = document.querySelector('#contributors-list');
  const status = document.querySelector('#contributors-status');
  if (!list || !status) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  status.textContent = '公開メンバーを読み込んでいます…';
  list.setAttribute('aria-busy', 'true');

  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  try {
    const response = await fetch(new URL('../data/members.json', scriptUrl), { signal: controller.signal });
    if (!response.ok) throw new Error(`Data HTTP ${response.status}`);
    const members = await response.json();
    if (!Array.isArray(members)) throw new Error('Invalid saved data');

    // Optional settings are separate from the generated membership snapshot.
    let themes = {};
    try {
      const response = await fetch(new URL('../data/member-themes.json', scriptUrl), { signal: controller.signal, cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          themes = Object.fromEntries(Object.entries(data).map(([login, theme]) => [login.toLowerCase(), theme]));
        }
      }
    } catch { /* A missing theme file must not hide the members. */ }

    let presets = {};
    let applyMemberTheme = () => {};
    try {
      const [response, module] = await Promise.all([
        fetch(new URL('../data/theme-presets.json', scriptUrl), { signal: controller.signal, cache: 'no-store' }),
        import(new URL('./member-theme.mjs?v=season-time-1', scriptUrl)),
      ]);
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && !Array.isArray(data)) presets = data;
      }
      applyMemberTheme = module.applyMemberTheme;
    } catch { /* Preset loading must not hide members. */ }

    let profiles = {}, appendProfile = () => {};
    try {
      const [response, module] = await Promise.all([
        fetch(new URL('../data/member-profiles.json', scriptUrl), { signal: controller.signal }),
        import(new URL('./member-profile.mjs', scriptUrl)),
      ]);
      if (response.ok) profiles = await response.json();
      appendProfile = module.appendProfile;
    } catch { /* Profiles are optional; the member list remains available. */ }
    members.sort((a, b) => (b.score ?? b.changed_lines ?? 0) - (a.score ?? a.changed_lines ?? 0) || (b.changed_lines || 0) - (a.changed_lines || 0) || a.login.localeCompare(b.login));
    const fragment = document.createDocumentFragment();
    const themedCards = [];
    for (const person of members) {
      if (typeof person.login !== 'string') throw new Error('Invalid member');
      const card = element('article', '', 'card contributor');
      const theme = themes[person.login.toLowerCase()];
      applyMemberTheme(card, theme, presets);
      if (['auto', 'auto-season', 'auto-time'].includes(theme?.theme)) themedCards.push({ card, theme });
      const avatar = document.createElement('img');
      // Construct URLs from the account name instead of trusting response URLs.
      avatar.src = `https://github.com/${encodeURIComponent(person.login)}.png?size=160`;
      avatar.alt = '';
      avatar.width = 80;
      avatar.height = 80;
      avatar.loading = 'lazy';
      const name = element('h3', person.login);
      const link = element('a', 'GitHub プロフィール ↗', 'text-link');
      link.href = `https://github.com/${encodeURIComponent(person.login)}`;
      const stats = element('p', `${(person.changed_lines || 0).toLocaleString('ja-JP')} 行の変更 · ${(person.commits || 0).toLocaleString('ja-JP')} コミット · ${(person.reviews || 0).toLocaleString('ja-JP')} レビュー`, 'note');
      card.append(avatar, name, stats, link);
      appendProfile(card, profiles?.[person.login.toLowerCase()], scriptUrl);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
    if (themedCards.length) {
      const refresh = () => {
        const now = new Date();
        for (const { card, theme } of themedCards) applyMemberTheme(card, theme, presets, now);
      };
      setInterval(refresh, 60_000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    }
    status.textContent = members.length
      ? `${members.length} 人の公開メンバーを表示しています。`
      : '公開設定のメンバーはまだいません。';
  } catch {
    status.textContent = '最新情報を取得できませんでした。下の GitHub リンクから公開メンバーをご覧ください。';
  } finally {
    clearTimeout(timeout);
    list.setAttribute('aria-busy', 'false');
  }
})(document.currentScript.src);
