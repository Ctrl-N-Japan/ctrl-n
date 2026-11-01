'use strict';

// Keep the static introduction available until the complete list is loaded.
(async () => {
  const list = document.querySelector('#contributors-list');
  const status = document.querySelector('#contributors-status');
  if (!list || !status) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  status.textContent = 'コントリビューターを読み込んでいます…';
  list.setAttribute('aria-busy', 'true');

  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  try {
    const contributors = [];
    for (let page = 1; ; page += 1) {
      const response = await fetch(
        `https://api.github.com/repos/Ctrl-N-Japan/ctrl-n/contributors?per_page=100&page=${page}`,
        { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal }
      );
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
      const batch = response.status === 204 ? [] : await response.json();
      if (!Array.isArray(batch)) throw new Error('Invalid contributor list');
      contributors.push(...batch);
      if (batch.length < 100) break;
    }

    const fragment = document.createDocumentFragment();
    for (const person of contributors) {
      if (typeof person.login !== 'string') throw new Error('Invalid contributor');
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
      card.append(avatar, name, link);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
    status.textContent = contributors.length
      ? `${contributors.length} 人のコントリビューターを表示しています。`
      : 'コントリビューターはまだいません。';
  } catch {
    status.textContent = '最新情報を取得できませんでした。下の GitHub リンクからコントリビューターをご覧ください。';
  } finally {
    clearTimeout(timeout);
    list.setAttribute('aria-busy', 'false');
  }
})();
