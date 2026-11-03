'use strict';

// Read the saved snapshot; page views do not call the GitHub API.

(async (scriptUrl) => {
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
    const response = await fetch(new URL('../data/repos.json', scriptUrl), { signal: controller.signal });
    if (!response.ok) throw new Error(`Data HTTP ${response.status}`);
    const repositories = await response.json();
    if (!Array.isArray(repositories)) throw new Error('Invalid saved data');

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
})(document.currentScript.src);
