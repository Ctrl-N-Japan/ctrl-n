'use strict';

// Keep the static introduction available until the complete list is loaded.
(async () => {
  const list = document.querySelector('#repo-list');
  const status = document.querySelector('#repo-status');
  if (!list || !status) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  status.textContent = '公開リポジトリを読み込んでいます…';
  list.setAttribute('aria-busy', 'true');

  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  try {
    const repositories = [];
    for (let page = 1; ; page += 1) {
      const response = await fetch(
        `https://api.github.com/orgs/Ctrl-N-Japan/repos?type=public&sort=updated&per_page=100&page=${page}`,
        { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal }
      );
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
      const batch = await response.json();
      if (!Array.isArray(batch)) throw new Error('Invalid repository list');
      repositories.push(...batch);
      if (batch.length < 100) break;
    }

    const fragment = document.createDocumentFragment();
    for (const repo of repositories) {
      if (typeof repo.name !== 'string') throw new Error('Invalid repository name');
      const card = element('article', '', 'card project');
      const details = element('div', '');
      details.append(element('h2', repo.name));
      details.append(element('p', repo.description || '説明はまだ登録されていません。'));
      const tags = element('div', '', 'tags');
      if (repo.language) tags.append(element('span', repo.language));
      if (repo.archived) tags.append(element('span', 'アーカイブ'));
      if (tags.childElementCount) details.append(tags);
      const link = element('a', 'リポジトリを見る ↗', 'button');
      link.href = `https://github.com/Ctrl-N-Japan/${encodeURIComponent(repo.name)}`;
      card.append(details, link);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
    status.textContent = repositories.length
      ? `${repositories.length} 件の公開リポジトリを表示しています。`
      : '公開リポジトリはまだありません。';
  } catch {
    status.textContent = '最新情報を取得できませんでした。掲載中の紹介、または下の GitHub リンクをご覧ください。';
  } finally {
    clearTimeout(timeout);
    list.setAttribute('aria-busy', 'false');
  }
})();
