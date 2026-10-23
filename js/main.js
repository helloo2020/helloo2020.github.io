(function () {
  'use strict';

  /* 深色 / 浅色模式切换 */
  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var html = document.documentElement;
      if (html.getAttribute('data-theme') === 'dark') {
        html.removeAttribute('data-theme');
        try { localStorage.setItem('theme', 'light'); } catch (e) {}
      } else {
        html.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('theme', 'dark'); } catch (e) {}
      }
      var dark = html.getAttribute('data-theme') === 'dark';
      html.style.colorScheme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]').content = dark ? '#181E1B' : '#FDFDFB';
    });
  }

  /* 首页连续阅读：保留静态分页作为无 JavaScript / 旧浏览器后备。 */
  var postList = document.querySelector('[data-post-list]');
  var pagination = document.querySelector('[data-post-pagination]');
  var nextLink = pagination && pagination.querySelector('[data-next-page]');
  if (postList && nextLink && window.IntersectionObserver && window.fetch && window.AbortController) {
    var status = pagination.querySelector('[data-pagination-status]');
    var retry = pagination.querySelector('[data-pagination-retry]');
    var nextURL = new URL(nextLink.href, location.href);
    var loadedPages = new Set([location.pathname]);
    var loading = false;
    var failed = false;
    pagination.classList.add('is-continuous');
    nextLink.hidden = true;

    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; }) && !failed) loadNextPage();
    }, { rootMargin: '0px 0px 240px 0px' });

    function loadNextPage() {
      if (loading || !nextURL) return;
      loading = true;
      failed = false;
      var restoreFocus = document.activeElement === retry;
      retry.hidden = true;
      nextLink.hidden = true;
      status.hidden = false;
      status.textContent = '正在加载文章…';
      postList.setAttribute('aria-busy', 'true');
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      var requestedURL = nextURL;

      fetch(requestedURL.href, { signal: controller.signal, mode: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('Page unavailable');
          return response.text().then(function (html) {
            return { html: html, url: response.url || requestedURL.href };
          });
        })
        .then(function (result) {
          var page = new DOMParser().parseFromString(result.html, 'text/html');
          var articles = Array.prototype.slice.call(page.querySelectorAll('[data-post-list] > .post-item'));
          var existingLinks = new Set(Array.prototype.map.call(postList.querySelectorAll('h2 a'), function (a) {
            return a.getAttribute('href');
          }));
          articles = articles.filter(function (article) {
            var title = article.querySelector('h2 a');
            return title && !existingLinks.has(title.getAttribute('href'));
          });
          if (!articles.length) throw new Error('No new articles');
          var following = page.querySelector('[data-post-pagination] [data-next-page]');
          var followingURL = following ? new URL(following.getAttribute('href'), result.url) : null;
          if (followingURL && (followingURL.origin !== location.origin || loadedPages.has(followingURL.pathname) || followingURL.pathname === requestedURL.pathname)) {
            throw new Error('Invalid next page');
          }
          var fragment = document.createDocumentFragment();
          articles.forEach(function (article) { fragment.appendChild(document.importNode(article, true)); });
          var firstNewTitle = fragment.querySelector('h2 a');
          postList.appendChild(fragment);
          loadedPages.add(requestedURL.pathname);
          nextURL = followingURL;
          if (nextURL) nextLink.href = nextURL.href;
          status.textContent = nextURL ? '' : '已显示全部文章';
          status.hidden = Boolean(nextURL);
          if (!nextURL) observer.disconnect();
          if (restoreFocus && firstNewTitle) firstNewTitle.focus({ preventScroll: true });
          failed = false;
        })
        .catch(function () {
          failed = true;
          status.textContent = '文章暂时未能加载';
          retry.hidden = false;
          nextLink.hidden = false;
        })
        .then(function () {
          clearTimeout(timeout);
          loading = false;
          postList.removeAttribute('aria-busy');
        });
    }

    retry.addEventListener('click', loadNextPage);
    observer.observe(pagination);
  }

  /* 文章目录 */
  var content = document.querySelector('.post-content');
  var tocDesktop = document.getElementById('toc-desktop');
  var tocDesktopList = document.getElementById('toc-desktop-list');
  var tocMobile = document.getElementById('toc-mobile');
  var tocMobileList = document.getElementById('toc-mobile-list');
  if (content && tocDesktop && tocDesktopList && tocMobile && tocMobileList) {
    var headings = Array.prototype.filter.call(
      content.querySelectorAll('h1, h2, h3'),
      function (h) { return h.id; }
    );
    if (headings.length > 1) {
      var firstLevel = Math.min.apply(null, headings.map(function (heading) {
        return Number(heading.tagName.slice(1));
      }));
      headings.forEach(function (heading) {
        var li = document.createElement('li');
        li.className = 'toc-depth-' + (Number(heading.tagName.slice(1)) - firstLevel);
        var a = document.createElement('a');
        a.href = '#' + heading.id;
        a.textContent = heading.textContent;
        li.appendChild(a);
        tocDesktopList.appendChild(li.cloneNode(true));
        tocMobileList.appendChild(li);
      });
      tocDesktop.hidden = false;
      tocMobile.hidden = false;
    }
  }

  /* 归档：标签 / 年份各自筛选，不叠加。 */
  var tagPanel = document.getElementById('tag-filters');
  var yearPanel = document.getElementById('year-filters');
  var modeGroup = document.querySelector('.archive-filter-modes');
  if (tagPanel && yearPanel && modeGroup) {
    var archiveMode = 'tag';
    var selectedFilters = { tag: '全部', year: '全部' };
    var modeButtons = Array.from(modeGroup.querySelectorAll('[data-filter-mode]'));
    var tagButtons = Array.from(tagPanel.querySelectorAll('[data-filter]'));
    var yearButtons = Array.from(yearPanel.querySelectorAll('[data-year-filter]'));
    var archiveYears = Array.from(document.querySelectorAll('.archive-year'));
    function applyArchiveFilter() {
      tagPanel.hidden = archiveMode !== 'tag';
      yearPanel.hidden = archiveMode !== 'year';
      modeButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filterMode === archiveMode)); });
      tagButtons.concat(yearButtons).forEach(function (b) {
        var selected = b.hasAttribute('data-filter') ? b.dataset.filter === selectedFilters.tag : b.dataset.yearFilter === selectedFilters.year;
        b.classList.toggle('is-active', selected);
        b.setAttribute('aria-pressed', String(selected));
      });
      archiveYears.forEach(function (year) {
        var visible = false;
        year.querySelectorAll('.archive-item').forEach(function (item) {
          var filter = selectedFilters[archiveMode];
          var matches = filter === '全部' || (archiveMode === 'year' ? year.dataset.year === filter : (' ' + item.dataset.tags + ' ').indexOf(' ' + filter + ' ') !== -1);
          item.hidden = !matches;
          visible = visible || matches;
        });
        year.hidden = !visible;
      });
    }
    modeButtons.forEach(function (b) { b.addEventListener('click', function () { archiveMode = b.dataset.filterMode; applyArchiveFilter(); }); });
    tagButtons.forEach(function (b) { b.addEventListener('click', function () { selectedFilters.tag = b.dataset.filter; applyArchiveFilter(); }); });
    yearButtons.forEach(function (b) { b.addEventListener('click', function () { selectedFilters.year = b.dataset.yearFilter; applyArchiveFilter(); }); });
    try {
      var initialTag = decodeURIComponent(location.hash.slice(1));
      if (tagButtons.some(function (b) { return b.dataset.filter === initialTag; })) selectedFilters.tag = initialTag;
    } catch (e) { /* Invalid hash leaves all articles visible. */ }
    window.addEventListener('hashchange', function () {
      try {
        var tag = decodeURIComponent(location.hash.slice(1));
        if (tagButtons.some(function (b) { return b.dataset.filter === tag; })) {
          archiveMode = 'tag'; selectedFilters.tag = tag; applyArchiveFilter();
        }
      } catch (e) {}
    });
    modeGroup.hidden = false;
    applyArchiveFilter();
  }

  /* 复制按钮 */
  var copyButtons = Array.prototype.slice.call(document.querySelectorAll('.copy-btn'));
  copyButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      if (!text) return;
      var original = btn.textContent;
      var copied = function () {
        btn.classList.add('is-copied');
        btn.textContent = '已复制';
        setTimeout(function () {
          btn.classList.remove('is-copied');
          btn.textContent = original;
        }, 1500);
      };
      var fallbackCopy = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          copied();
        } catch (e) {}
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(copied, fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  });
})();
