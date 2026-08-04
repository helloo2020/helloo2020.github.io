(function () {
  'use strict';

  /* 移动端导航 */
  var nav = document.getElementById('site-nav');
  var toggle = document.getElementById('nav-toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
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
          item.hidden = filter === '全部' || tags.indexOf(' ' + filter + ' ') > -1;
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
})();
