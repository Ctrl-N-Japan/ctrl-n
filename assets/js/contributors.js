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

    members.sort((a, b) => (b.changed_lines || 0) - (a.changed_lines || 0) || a.login.localeCompare(b.login));
    const fragment = document.createDocumentFragment();
    for (const person of members) {
      if (typeof person.login !== 'string') throw new Error('Invalid member');
      const card = element('article', '', 'card contributor');
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
      const stats = element('p', `${(person.changed_lines || 0).toLocaleString('ja-JP')} 行の変更 · ${(person.commits || 0).toLocaleString('ja-JP')} コミット`, 'note');
      card.append(avatar, name, stats, link);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
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
