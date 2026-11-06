/* ES5-only fallback for Internet Explorer 11. */
(function () {
  'use strict';
  if (!document.documentMode) return;
  var scripts = document.getElementsByTagName('script');
  var script;
  for (var index = 0; index < scripts.length; index++) {
    if (/\/ie11\.js(?:[?#]|$)/.test(scripts[index].src)) script = scripts[index];
  }
  if (!script) return;
  var assetRoot = script.src.replace(/js\/ie11\.js.*$/, '');
  var siteRoot = assetRoot.replace(/assets\/$/, '');
  var sheet = document.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = assetRoot + 'css/ie11.css';
  document.head.appendChild(sheet);
  function node(tag, text, className) {
    var result = document.createElement(tag);
    result.textContent = text || '';
    if (className) result.className = className;
    return result;
  }
  function load(name, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', assetRoot + 'data/' + name, true); xhr.timeout = 10000;
    xhr.onload = function () {
      try { if (xhr.status < 200 || xhr.status >= 300) throw new Error('HTTP'); callback(null, JSON.parse(xhr.responseText)); }
      catch (error) { callback(error); }
    };
    xhr.onerror = xhr.ontimeout = function () { callback(new Error('Data unavailable')); };
    xhr.send();
  }
  function clear(element) { while (element.firstChild) element.removeChild(element.firstChild); }
  function safeLink(value) {
    var link = document.createElement('a'); link.href = value || '';
    return link.protocol === 'https:' && !link.username && !link.password ? link.href : '';
  }
  function profile(card, data) {
    if (!data) return;
    if (data.displayName) card.querySelector('h3').textContent = data.displayName;
    if (data.bio) card.appendChild(node('p', data.bio, 'member-bio'));
    var tags = node('div', '', 'tags');
    (data.skills || []).forEach(function (skill) { tags.appendChild(node('span', skill)); });
    card.appendChild(tags);
    var work = data.work || {};
    if (work.title) card.appendChild(node('h4', work.title));
    if (work.description) card.appendChild(node('p', work.description));
    (data.images || []).forEach(function (path) {
      if (!/^assets\/images\/members\/[a-z0-9-]+\.(png|jpg|webp)$/.test(path)) return;
      var image = node('img', '', 'member-work-image'); image.src = siteRoot + path;
      image.alt = work.description || work.title || '作品画像'; card.appendChild(image);
    });
    var href = safeLink(work.url);
    if (href) { var link = node('a', '作品を開く ↗', 'text-link'); link.href = href; card.appendChild(link); }
  }
  function ready() {
    var root = document.documentElement, preference = 'system';
    try { preference = localStorage.getItem('ctrl-n-theme') || 'system'; } catch (ignore) {}
    var inputs = document.querySelectorAll('input[name="theme"]');
    function theme() {
      root.className = preference === 'dark' ? 'ie-dark' : 'ie-light';
      var current = document.querySelector('[data-theme-current]');
      if (current) current.textContent = preference.charAt(0).toUpperCase() + preference.slice(1);
      for (var i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === preference;
    }
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].disabled = false;
      inputs[i].onchange = function () {
        preference = this.value; theme();
        try { localStorage.setItem('ctrl-n-theme', preference); } catch (ignore) {}
      };
    }
    theme(); // IE11 has no OS dark-mode media query; System uses light.
    var list = document.getElementById('contributors-list');
    if (list) {
      var status = document.getElementById('contributors-status');
      list.setAttribute('aria-busy', 'true');
      load('members.json', function (error, members) {
        if (error || !Array.isArray(members)) { status.textContent = 'メンバーを取得できませんでした。GitHubリンクをご覧ください。'; list.setAttribute('aria-busy', 'false'); return; }
        load('member-profiles.json', function (ignored, profiles) {
          members.sort(function (a, b) { return (typeof b.score === 'number' ? b.score : b.changed_lines || 0) - (typeof a.score === 'number' ? a.score : a.changed_lines || 0) || (b.changed_lines || 0) - (a.changed_lines || 0) || a.login.localeCompare(b.login); });
          var fragment = document.createDocumentFragment();
          members.forEach(function (person) {
            var card = node('article', '', 'card contributor'), avatar = node('img');
            avatar.src = 'https://github.com/' + encodeURIComponent(person.login) + '.png?size=160'; avatar.alt = ''; avatar.width = avatar.height = 80;
            card.appendChild(avatar); card.appendChild(node('h3', person.login));
            card.appendChild(node('p', (person.changed_lines || 0) + ' 行の変更 · ' + (person.commits || 0) + ' コミット · ' + (person.reviews || 0) + ' レビュー', 'note'));
            var link = node('a', 'GitHub プロフィール ↗', 'text-link'); link.href = 'https://github.com/' + encodeURIComponent(person.login); card.appendChild(link);
            profile(card, profiles && profiles[person.login.toLowerCase()]); fragment.appendChild(card);
          });
          clear(list); list.appendChild(fragment); list.setAttribute('aria-busy', 'false');
          status.textContent = members.length + ' 人の公開メンバーを表示しています。';
        });
      });
    }
    var repos = document.getElementById('repo-list');
    if (repos) {
      var repoStatus = document.getElementById('repo-status');
      repos.setAttribute('aria-busy', 'true');
      load('repos.json', function (error, data) {
        repos.setAttribute('aria-busy', 'false');
        if (error || !Array.isArray(data)) { repoStatus.textContent = '最新情報を取得できませんでした。掲載中の紹介をご覧ください。'; return; }
        var fragment = document.createDocumentFragment();
        data.forEach(function (repo) {
          var card = node('article', '', 'card project');
          card.appendChild(node('h2', repo.name)); card.appendChild(node('p', repo.description || '説明はまだ登録されていません。'));
          var tags = node('div', '', 'tags');
          if (repo.language) tags.appendChild(node('span', repo.language));
          if (repo.archived) tags.appendChild(node('span', 'アーカイブ'));
          card.appendChild(tags);
          var link = node('a', 'リポジトリを見る ↗', 'button'); link.href = 'https://github.com/Ctrl-N-Japan/' + encodeURIComponent(repo.name); card.appendChild(link); fragment.appendChild(card);
        });
        clear(repos); repos.appendChild(fragment); repoStatus.textContent = data.length + ' 件の公開リポジトリを表示しています。';
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
