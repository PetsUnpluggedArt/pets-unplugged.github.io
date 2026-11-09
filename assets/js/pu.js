/* Pets Unplugged: small page helpers. Everything works without this file; it only adds the extras. */
(function () {
  'use strict';

  // Mobile menu
  var btn = document.querySelector('[data-menu]');
  var nav = document.getElementById('mnav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      nav.hidden = open;
    });
  }

  // Color-in slider: the range input moves the edge of the colored picture
  document.querySelectorAll('[data-slider]').forEach(function (fig) {
    var box = fig.querySelector('.slider-box');
    var input = fig.querySelector('input[type=range]');
    if (!box || !input) return;
    var set = function () { box.style.setProperty('--pct', input.value + '%'); };
    input.addEventListener('input', set);
    set();
  });

  // Filter buttons (books: Dogs/Cats/Holidays/Seasons, merch: kinds)
  document.querySelectorAll('[data-filters]').forEach(function (group) {
    var list = document.getElementById(group.getAttribute('data-filters'));
    if (!list) return;
    var status = document.getElementById(group.getAttribute('data-status'));
    group.querySelectorAll('button[data-f]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f');
        group.querySelectorAll('button[data-f]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        var shown = 0;
        list.querySelectorAll('[data-tags]').forEach(function (item) {
          var on = f === 'All' || (' ' + item.getAttribute('data-tags') + ' ').indexOf(' ' + f + ' ') >= 0;
          item.hidden = !on;
          if (on) shown++;
        });
        if (status) status.textContent = shown + (shown === 1 ? ' page' : ' pages') + ' shown';
      });
    });
  });

  // Episode tabs (pet stories)
  document.querySelectorAll('[role=tablist][data-eps]').forEach(function (tl) {
    var tabs = Array.prototype.slice.call(tl.querySelectorAll('[role=tab]'));
    var pick = function (t, focus) {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.tabIndex = on ? 0 : -1;
        var p = document.getElementById(o.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
      if (focus) t.focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, j = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % tabs.length;
        if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (k === 'Home') j = 0;
        if (k === 'End') j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); pick(tabs[j], true); }
      });
    });
  });

  // Free video preview: load the Vimeo player only when asked
  document.querySelectorAll('[data-vimeo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = document.getElementById(b.getAttribute('aria-controls'));
      if (!box) return;
      var src = 'https://player.vimeo.com/video/' + b.getAttribute('data-vimeo') + '?autoplay=1&loop=1&title=0&byline=0&portrait=0&dnt=1';
      var h = b.getAttribute('data-hash');
      if (h) src += '&h=' + h;
      var wrap = document.createElement('div');
      wrap.className = 'vframe';
      var f = document.createElement('iframe');
      f.src = src;
      f.title = b.getAttribute('data-title') || 'Video';
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      wrap.appendChild(f);
      box.innerHTML = '';
      box.appendChild(wrap);
      f.focus();
    });
  });
})();
