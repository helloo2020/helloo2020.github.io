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
    });
  }

  /* 文章目录 */
  var content = document.querySelector('.post-content');
  var tocDesktop = document.getElementById('toc-desktop');
  var tocDesktopList = document.getElementById('toc-desktop-list');
  var tocMobile = document.getElementById('toc-mobile');
  var tocMobileList = document.getElementById('toc-mobile-list');
  if (content && tocDesktop && tocDesktopList && tocMobile && tocMobileList) {
    var headings = Array.prototype.filter.call(
      content.querySelectorAll('h2, h3'),
      function (h) { return h.id; }
    );
    if (headings.length > 1) {
      headings.forEach(function (heading) {
        var li = document.createElement('li');
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

  /* 归档标签筛选 */
  var pills = Array.prototype.slice.call(document.querySelectorAll('.filter-pills .pill'));
  var items = Array.prototype.slice.call(document.querySelectorAll('.archive-item'));
  var years = Array.prototype.slice.call(document.querySelectorAll('.archive-year'));
  if (pills.length && items.length) {
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('is-active'); });
        pill.classList.add('is-active');
        var filter = pill.getAttribute('data-filter');
        items.forEach(function (item) {
          var tags = ' ' + (item.getAttribute('data-tags') || '') + ' ';
          item.hidden = filter !== '全部' && tags.indexOf(' ' + filter + ' ') === -1;
        });
        years.forEach(function (year) {
          var visible = items.some(function (item) {
            return !item.hidden && year.contains(item);
          });
          year.hidden = !visible;
        });
      });
    });

    /* 从文章里的标签跳转过来时，自动按该标签筛选 */
    var initialHash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (initialHash) {
      var matchedPill = pills.filter(function (p) {
        return p.getAttribute('data-filter') === initialHash;
      })[0];
      if (matchedPill) matchedPill.click();
    }
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
